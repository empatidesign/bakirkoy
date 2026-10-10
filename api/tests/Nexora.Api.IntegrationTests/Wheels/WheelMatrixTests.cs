using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Wheels;

// Task 12, Step 2 (Wheels and gifts): daily spin limit, duplicate spin
// (wheel:spin-lock:{citizenId}:{wheelId}), gift stock race — BOTH the Redis spin-time race
// (SpinService.SpinAsync's wheel:gift-lock:{giftId}) AND the Postgres approve-time race
// (GiftRequestService.ApproveAsync's pg_advisory_xact_lock via GiftLockKey) — request
// transitions and cancellation.
//
// Ruling C: SpinService/ISpinService requires IRedisService directly (constructor parameter),
// same class of gap as Loyalty — uses the real-Redis factory host for the ENTIRE class.
// GiftRequestService.ApproveAsync's race uses the OTHER (Postgres advisory-lock) mechanism, but
// since ISpinService's tests already force this class onto the Redis-enabled host, the approve-time
// race test also runs here rather than requiring a second host/class split (Ruling A: use
// judgement — splitting a cohesive module's race coverage across two classes purely to chase a
// theoretical "purest" host assignment would not improve clarity).
//
// RED-phase correction to the brief's spin-race framing: RedisService.TryAcquireLockAsync
// (RedisService.cs line 33) is a SINGLE-ATTEMPT SET-NX with NO retry/backoff loop — verified by
// reading the real implementation. Two concurrent spins racing on the SAME wheel:gift-lock key
// (both landing on a 100%-WinRate gift slice) do NOT both "silently fall back" — the lock LOSER
// gets an immediate real 409 OPERATION_IN_PROGRESS from the lock acquisition itself. The brief's
// "silent fallback, no conflict" framing IS real, but only fires for the stock-exhaustion check
// that happens AFTER a lock is successfully acquired (proven separately, sequentially, below) —
// these are two different real behaviors for two different triggers, not one behavior
// mis-described. See both test cases' comments for the full distinction.
[Collection(ApiCollection.Name)]
public sealed class WheelMatrixTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;
    private HttpClient _admin = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
        _admin = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t12wh-{Guid.NewGuid():N}@nexora.local"));
    }

    public WheelMatrixTests(ApiTestHost host) { }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record SpinResult(string SliceLabel, string SliceType, int SliceValue, Guid? GiftId, Guid? GiftRequestId, int? PointsWon, int? RemainingSpinsToday);
    private sealed record IdOnly(Guid Id);

    private static async Task<Envelope<T>> ReadAsync<T>(HttpResponseMessage resp) =>
        JsonSerializer.Deserialize<Envelope<T>>(await resp.Content.ReadAsStringAsync(), Web)!;

    // ---------- RED-phase environmental confirmation (Ruling C) ----------

    [Fact]
    public async Task Default_host_cannot_resolve_ISpinService()
    {
        var defaultFactory = NexoraApiFactory.CreateForEnvironment("Testing");
        await defaultFactory.InitializeAsync();
        try
        {
            var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12DEF{Guid.NewGuid():N}"[..8], dailySpinLimit: 0,
                new List<WheelScenario.SliceSpec> { new("A", "empty", 0, 50), new("B", "empty", 0, 50) });
            var citizen = await defaultFactory.CreateCitizenClientAsync(Infrastructure.CitizenTestIdentity.Adult(seed: 400001));
            var resp = await citizen.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
            resp.StatusCode.Should().Be(HttpStatusCode.InternalServerError,
                "ISpinService requires IRedisService, unregistered against the default Redis-disabled host — matching the brief's exact prediction for this module");
        }
        finally
        {
            await defaultFactory.DisposeAsync();
        }
    }

    // ---------- Daily spin limit / duplicate spin lock ----------

    [Fact]
    public async Task Spin_beyond_daily_limit_returns_DAILY_SPIN_LIMIT_REACHED()
    {
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12LIM{Guid.NewGuid():N}"[..8], dailySpinLimit: 1,
            new List<WheelScenario.SliceSpec> { new("A", "empty", 0, 50), new("B", "empty", 0, 50) });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 400002);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        var first = await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        first.StatusCode.Should().Be(HttpStatusCode.OK, $"first spin must succeed; body: {await first.Content.ReadAsStringAsync()}");

        var second = await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict,
            "DailySpinLimit=1 must reject a second spin the same day");
        var body = await ReadAsync<object>(second);
        body.ErrorCode.Should().Be("DAILY_SPIN_LIMIT_REACHED");
    }

    [Fact]
    public async Task Spin_on_inactive_wheel_returns_WHEEL_NOT_ACTIVE()
    {
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12INA{Guid.NewGuid():N}"[..8], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("A", "empty", 0, 50), new("B", "empty", 0, 50) });
        (await _admin.PatchAsync($"/api/v1/wheels/{wheelId}/toggle-status", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 400003);
        var client = await _factory.CreateCitizenClientAsync(citizen);
        var resp = await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync<object>(resp);
        body.ErrorCode.Should().Be("WHEEL_NOT_ACTIVE");
    }

    // ---------- Gift stock race #1: spin-time (Redis SET-NX, single-attempt lock, real conflict) --

    [Fact]
    public async Task Concurrent_spins_for_the_same_gift_slice_serialize_one_wins_the_gift_lock_the_other_gets_a_real_conflict()
    {
        // RED-phase finding, corrects the brief's framing: RedisService.TryAcquireLockAsync is a
        // SINGLE-ATTEMPT SET-NX (StringSetAsync(..., When.NotExists)) with NO retry/backoff loop —
        // verified by reading RedisService.cs directly. So when two citizens' spins BOTH land on the
        // same gift slice (100% WinRate here) and race on the shared wheel:gift-lock:{giftId} key,
        // the loser does NOT get a soft "silent fallback" (that only happens when the gift is
        // legitimately out of stock/inactive, checked AFTER acquiring the lock) — it gets an
        // immediate real 409 OPERATION_IN_PROGRESS from the lock acquisition itself, confirmed
        // empirically in this RED-phase run. Both are real, correct behaviors for DIFFERENT
        // triggers (lock contention vs. stock exhaustion); this test proves the lock-contention one.
        var giftId = await WheelScenario.CreateGiftAsync(_admin, $"T12GR{Guid.NewGuid():N}"[..8], points: 0, stockLimit: 5);
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12GW{Guid.NewGuid():N}"[..8], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Hediye", "gift", 0, 100, giftId), new("Boş", "empty", 0, 0) });

        var citizenA = Infrastructure.CitizenTestIdentity.Adult(seed: 400004);
        var citizenB = Infrastructure.CitizenTestIdentity.Adult(seed: 400005);
        var clientA = await _factory.CreateCitizenClientAsync(citizenA);
        var clientB = await _factory.CreateCitizenClientAsync(citizenB);

        var taskA = clientA.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        var taskB = clientB.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        var responses = await Task.WhenAll(taskA, taskB);

        var statuses = responses.Select(r => r.StatusCode).ToList();
        statuses.Count(s => s == HttpStatusCode.OK).Should().Be(1,
            "exactly one of the two real concurrent spins must win the single-attempt wheel:gift-lock");
        statuses.Count(s => s == HttpStatusCode.Conflict).Should().Be(1,
            "the loser must get a real 409 from the lock acquisition itself (no retry/backoff in TryAcquireLockAsync)");

        var conflictResp = responses[statuses.IndexOf(HttpStatusCode.Conflict)];
        var conflictBody = await ReadAsync<object>(conflictResp);
        conflictBody.ErrorCode.Should().Be("OPERATION_IN_PROGRESS");
    }

    [Fact]
    public async Task Sequential_spins_against_gift_stock_limit_fall_back_silently_once_stock_is_exhausted()
    {
        // The brief's ORIGINAL framing (silent fallback on stock exhaustion, no conflict) IS real —
        // it just requires the lock to NOT be contended (sequential spins, not concurrent ones) so
        // the second spin actually reaches the post-lock stock check
        // (gift.AwardedCount + pendingCount >= gift.StockLimit) rather than failing on lock
        // acquisition first. StockLimit=1: first spin creates the real GiftRequest (pendingCount
        // becomes 1), second spin sees 0+1>=1 and falls back to the synthetic empty slice — no
        // error, still 200 OK, per the brief's finding.
        var giftId = await WheelScenario.CreateGiftAsync(_admin, $"T12SEQ{Guid.NewGuid():N}"[..6], points: 0, stockLimit: 1);
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12SEQW{Guid.NewGuid():N}"[..6], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Hediye", "gift", 0, 100, giftId), new("Boş", "empty", 0, 0) });

        var citizenA = Infrastructure.CitizenTestIdentity.Adult(seed: 400010);
        var citizenB = Infrastructure.CitizenTestIdentity.Adult(seed: 400011);
        var clientA = await _factory.CreateCitizenClientAsync(citizenA);
        var clientB = await _factory.CreateCitizenClientAsync(citizenB);

        var respA = await clientA.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        respA.StatusCode.Should().Be(HttpStatusCode.OK, $"first spin must succeed and consume the only stock slot; body: {await respA.Content.ReadAsStringAsync()}");
        var bodyA = (await ReadAsync<SpinResult>(respA)).Data!;
        bodyA.GiftId.Should().NotBeNull("the first spin must win the real gift slot");

        var respB = await clientB.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        respB.StatusCode.Should().Be(HttpStatusCode.OK,
            $"the second spin must still return 200 (silent fallback, not a conflict) once stock is exhausted; body: {await respB.Content.ReadAsStringAsync()}");
        var bodyB = (await ReadAsync<SpinResult>(respB)).Data!;
        bodyB.GiftId.Should().BeNull("the second spin must fall back to the synthetic empty slice, not double-create a GiftRequest against exhausted stock");
        bodyB.SliceType.Should().Be("empty");
    }

    // ---------- Gift stock race #2: approve-time (Postgres advisory lock, real conflict) ----------

    [Fact]
    public async Task Concurrent_approvals_against_gift_stock_limit_serialize_to_exactly_one_success()
    {
        // Real concurrency mechanism: GiftRequestService.ApproveAsync uses
        // pg_advisory_xact_lock via GiftLockKey(giftId) — a DIFFERENT mechanism from the spin-time
        // Redis lock, with a real documented prior bug fixed by this exact lock (see the Turkish
        // comment above ApproveAsync: two concurrent admin approvals both returned 200 when
        // AwardedCount=1/StockLimit=1). Two REAL pending GiftRequest rows for the SAME gift
        // (StockLimit=1), two concurrent admin /approve calls — exactly one must win.
        var giftId = await WheelScenario.CreateGiftAsync(_admin, $"T12AP{Guid.NewGuid():N}"[..8], points: 0, stockLimit: 1, winnerPattern: new List<int> { 1, 2 });
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12APW{Guid.NewGuid():N}"[..8], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Hediye", "gift", 0, 100, giftId), new("Boş", "empty", 0, 0) });

        var citizenA = Infrastructure.CitizenTestIdentity.Adult(seed: 400006);
        var citizenB = Infrastructure.CitizenTestIdentity.Adult(seed: 400007);
        var clientA = await _factory.CreateCitizenClientAsync(citizenA);
        var clientB = await _factory.CreateCitizenClientAsync(citizenB);

        // Spin sequentially (not concurrently) so we get two REAL Pending GiftRequest rows for the
        // same gift, deterministically (StockLimit=1 doesn't block request CREATION, only
        // AwardedCount at approve-time — verified by reading SpinAsync's own gift-availability
        // check, which only compares AwardedCount+pendingCount, and StockLimit=1 with 0 awarded and
        // 0 pending at each sequential spin's check-time allows both to create a request).
        var respA = await clientA.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        respA.StatusCode.Should().Be(HttpStatusCode.OK, $"first sequential spin must succeed; body: {await respA.Content.ReadAsStringAsync()}");
        var reqA = (await ReadAsync<SpinResult>(respA)).Data!;

        // Second spin will see AwardedCount(0)+pendingCount(1) >= StockLimit(1) and silently fall
        // back (per the spin-time behavior proven above) — so drive the SECOND real pending
        // GiftRequest via the citizen-initiated points-based application path instead
        // (GiftApplicationService.ApplyAsync), which uses the SAME gift-lock but a DIFFERENT stock
        // pre-check timing quirk isn't relevant here — Ruling: to get two real Pending requests for
        // the SAME gift/StockLimit=1 deterministically, temporarily raise StockLimit before the
        // second creation, matching how a real admin might over-allocate slightly then need the
        // approve-time lock to enforce the true cap.
        (await _admin.PutAsJsonAsync($"/api/v1/gifts/{giftId}",
            new { name = $"T12AP{Guid.NewGuid():N}"[..8], imageUrl = (string?)null, points = 0, stockLimit = 2, winnerPattern = new List<int> { 1, 2 }, description = (string?)null }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var respB = await clientB.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        respB.StatusCode.Should().Be(HttpStatusCode.OK, $"second sequential spin (after raising StockLimit to 2) must succeed; body: {await respB.Content.ReadAsStringAsync()}");
        var reqB = (await ReadAsync<SpinResult>(respB)).Data!;

        reqA.GiftId.Should().NotBeNull("first spin must have won the gift slice");
        reqB.GiftId.Should().NotBeNull("second spin must have won the gift slice after StockLimit was raised");

        // Now lower StockLimit back to 1 (simulating the real "over-allocated, must enforce the
        // true cap at approve-time" scenario the lock exists for) and approve both pending requests
        // concurrently.
        (await _admin.PutAsJsonAsync($"/api/v1/gifts/{giftId}",
            new { name = $"T12AP{Guid.NewGuid():N}"[..8], imageUrl = (string?)null, points = 0, stockLimit = 1, winnerPattern = new List<int> { 1, 2 }, description = (string?)null }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var approveA = _admin.PatchAsync($"/api/v1/gift-requests/{reqA.GiftRequestId}/approve", null);
        var approveB = _admin.PatchAsync($"/api/v1/gift-requests/{reqB.GiftRequestId}/approve", null);
        var approvals = await Task.WhenAll(approveA, approveB);

        var statuses = approvals.Select(r => r.StatusCode).ToList();
        statuses.Count(s => s == HttpStatusCode.OK).Should().Be(1,
            "exactly one of the two real concurrent approvals against StockLimit=1 must win the pg_advisory_xact_lock race");
        statuses.Count(s => s == HttpStatusCode.Conflict).Should().Be(1,
            "the other concurrent approval must be rejected with a real conflict once AwardedCount reaches StockLimit, not silently over-award");

        var conflictResp = approvals[statuses.IndexOf(HttpStatusCode.Conflict)];
        var conflictBody = await ReadAsync<object>(conflictResp);
        conflictBody.ErrorCode.Should().Be("GIFT_STOCK_EXCEEDED");
    }

    // ---------- Puan algoritması (2026-09-20 kullanıcı isteği: gün içinde çevrilen sıraya göre
    // otomatik değişen puan, azami puan ve azami çevirme sayısı sınırı) ----------

    [Fact]
    public async Task Points_algorithm_disabled_uses_slice_fixed_value()
    {
        // Algoritma kapalıysa (varsayılan), 'points' diliminin sabit Value'su hiç değişmeden
        // önceki davranışla aynı şekilde puan olarak verilmelidir — geriye dönük uyumluluk.
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T20OFF{Guid.NewGuid():N}"[..6], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("50 Puan", "points", 50, 100), new("Boş", "empty", 0, 0) });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 420001);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        var resp = await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK, $"spin must succeed; body: {await resp.Content.ReadAsStringAsync()}");
        var result = (await ReadAsync<SpinResult>(resp)).Data!;
        result.PointsWon.Should().Be(50, "algorithm is disabled, so the slice's own fixed Value must be used unchanged");
    }

    [Fact]
    public async Task Points_algorithm_enabled_awards_increasing_points_per_spin_number_today_capped_at_max()
    {
        // Başlangıç=10, Adım=+10, Azami=25, AzamiÇevirme=0(sınırsız):
        // 1. çevirme -> 10, 2. çevirme -> 20, 3. çevirme -> 30 ama Azami Puan=25'i geçemez -> 25.
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T20ALG{Guid.NewGuid():N}"[..6], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Puan", "points", 999, 100), new("Boş", "empty", 0, 0) },
            pointsAlgorithmEnabled: true, pointsAlgorithmBase: 10, pointsAlgorithmStep: 10, pointsAlgorithmMax: 25, pointsAlgorithmMaxSpins: 0);

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 420002);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        var r1 = (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!;
        r1.PointsWon.Should().Be(10, "1st spin today must get PointsAlgorithmBase");

        var r2 = (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!;
        r2.PointsWon.Should().Be(20, "2nd spin today must get Base + 1*Step");

        var r3 = (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!;
        r3.PointsWon.Should().Be(25, "3rd spin would compute 30 but PointsAlgorithmMax=25 must cap it");
    }

    [Fact]
    public async Task Points_algorithm_beyond_max_spins_falls_back_to_slice_fixed_value()
    {
        // AzamiÇevirme=1: yalnızca günün 1. çevirmesinde algoritma uygulanır; 2. çevirmede
        // dilimin kendi sabit Value'suna (777) geri dönülmelidir.
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T20MAXS{Guid.NewGuid():N}"[..6], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Puan", "points", 777, 100), new("Boş", "empty", 0, 0) },
            pointsAlgorithmEnabled: true, pointsAlgorithmBase: 50, pointsAlgorithmStep: 0, pointsAlgorithmMax: 0, pointsAlgorithmMaxSpins: 1);

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 420003);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        var r1 = (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!;
        r1.PointsWon.Should().Be(50, "1st spin is within PointsAlgorithmMaxSpins=1, uses the algorithm");

        var r2 = (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!;
        r2.PointsWon.Should().Be(777, "2nd spin exceeds PointsAlgorithmMaxSpins=1, must fall back to the slice's own fixed Value");
    }

    [Fact]
    public async Task Points_algorithm_step_can_be_negative_diminishing_returns_but_never_below_zero()
    {
        // Başlangıç=30, Adım=-20: 1. çevirme=30, 2. çevirme=10, 3. çevirme would be -10 but must
        // clamp at 0 (never award negative points).
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T20NEG{Guid.NewGuid():N}"[..6], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Puan", "points", 5, 100), new("Boş", "empty", 0, 0) },
            pointsAlgorithmEnabled: true, pointsAlgorithmBase: 30, pointsAlgorithmStep: -20, pointsAlgorithmMax: 0, pointsAlgorithmMaxSpins: 0);

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 420004);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!.PointsWon.Should().Be(30);
        (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!.PointsWon.Should().Be(10);
        (await ReadAsync<SpinResult>(await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null))).Data!.PointsWon.Should().Be(0,
            "diminishing-returns step must clamp at 0, never go negative");
    }

    // ---------- Request transitions and cancellation (reject with refund) ----------

    [Fact]
    public async Task Reject_gift_application_refunds_spent_points()
    {
        var actionKey = $"t12wgapp{Guid.NewGuid():N}"[..10];
        var ruleResp = await _admin.PostAsJsonAsync("/api/v1/loyalty/rules", new { actionKey, label = "Wheel App Setup", points = 300, description = (string?)null });
        ruleResp.StatusCode.Should().Be(HttpStatusCode.Created);

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 400008);
        var client = await _factory.CreateCitizenClientAsync(citizen);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var svc = scope.ServiceProvider.GetRequiredService<Nexora.Application.Features.Loyalty.ILoyaltyService>();
            await svc.AwardPointsAsync(new Nexora.Application.Features.Loyalty.Requests.AwardPointsRequest(citizen.ParticipantId, actionKey, Guid.NewGuid().ToString()), default);
        }

        var giftId = await WheelScenario.CreateGiftAsync(_admin, $"T12APPGIFT{Guid.NewGuid():N}"[..4], points: 100, stockLimit: 5);
        var applyResp = await client.PostAsJsonAsync($"/api/v1/wheels/gifts/{giftId}/apply", new { });
        // Real finding: WheelSpinEndpoints.Apply wraps ApiResponse.Created(...) in Results.Ok(...)
        // (not Results.Created), so the HTTP status is 200 even though the JSON envelope's own
        // "statusCode" field says 201 — a real status-code/envelope mismatch (worth reporting, not
        // fixing here per this task's declared scope). Assert the real observed HTTP status.
        applyResp.StatusCode.Should().Be(HttpStatusCode.OK, $"gift application must succeed with sufficient balance; body: {await applyResp.Content.ReadAsStringAsync()}");
        var applied = (await ReadAsync<JsonElement>(applyResp)).Data;
        var requestId = applied.GetProperty("id").GetGuid();

        var balanceAfterApply = await ReadAsync<JsonElement>(await client.GetAsync("/api/v1/me/loyalty/balance"));
        balanceAfterApply.Data.GetProperty("balance").GetInt32().Should().Be(200, "300 earned - 100 spent on application = 200");

        var rejectResp = await _admin.PatchAsJsonAsync($"/api/v1/gift-requests/{requestId}/reject", new { reason = "test reject" });
        rejectResp.StatusCode.Should().Be(HttpStatusCode.OK, $"reject must succeed; body: {await rejectResp.Content.ReadAsStringAsync()}");

        var balanceAfterReject = await ReadAsync<JsonElement>(await client.GetAsync("/api/v1/me/loyalty/balance"));
        balanceAfterReject.Data.GetProperty("balance").GetInt32().Should().Be(300,
            "RejectAsync refunds GiftPoints for Source==\"application\" requests — real code path, per GiftRequestService.RejectAsync");
    }

    [Fact]
    public async Task Approve_non_pending_request_returns_REQUEST_NOT_PENDING()
    {
        var giftId = await WheelScenario.CreateGiftAsync(_admin, $"T12NP{Guid.NewGuid():N}"[..8], points: 0, stockLimit: 5);
        var wheelId = await WheelScenario.CreateWheelAsync(_admin, $"T12NPW{Guid.NewGuid():N}"[..8], dailySpinLimit: 0,
            new List<WheelScenario.SliceSpec> { new("Hediye", "gift", 0, 100, giftId), new("Boş", "empty", 0, 0) });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 400009);
        var client = await _factory.CreateCitizenClientAsync(citizen);
        var spinResp = await client.PostAsync($"/api/v1/wheels/{wheelId}/spin", null);
        var spinResult = (await ReadAsync<SpinResult>(spinResp)).Data!;

        (await _admin.PatchAsync($"/api/v1/gift-requests/{spinResult.GiftRequestId}/approve", null))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var secondApprove = await _admin.PatchAsync($"/api/v1/gift-requests/{spinResult.GiftRequestId}/approve", null);
        secondApprove.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync<object>(secondApprove);
        body.ErrorCode.Should().Be("REQUEST_NOT_PENDING");
    }
}
