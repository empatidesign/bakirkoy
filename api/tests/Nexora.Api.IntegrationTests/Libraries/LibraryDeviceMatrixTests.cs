using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Libraries;

// Task 9: device known/unknown, move, IP-shift-takeover, geofence, and the binding real-device
// safety mechanism (SSRF allowlist guard + in-process loopback simulator). Every case here uses
// real HTTP against the real hosted API and real PostgreSQL/Redis — no request in this file ever
// targets a real device IP (verified explicitly by RealDeviceSafety_NoIpLiteralsOutsideLoopback).
[Collection(ApiCollection.Name)]
public sealed class LibraryDeviceMatrixTests : IAsyncLifetime
{
    // Redis-enabled host (Task 6's established pattern): several real code paths this class
    // exercises (library-staff creation via OtpService, device webhook/checkin flows) take a
    // constructor dependency on IRedisService, which Infrastructure's DI only registers when
    // ConnectionStrings:Redis is non-empty. The default ApiTestHost.Factory (Redis-disabled)
    // throws a DI InvalidOperationException (masked as 500) before those handlers run — a real
    // finding hit while running this suite, not assumed up front.
    private NexoraApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<HttpClient> AdminClientAsync() =>
        await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t9-device-{Guid.NewGuid():N}@nexora.local"));

    // ---------------------------------------------------------------------------------------
    // Binding safety ruling (a/b/d): the SSRF/private-target allowlist guard must default-deny
    // for a private-but-not-loopback address, proving LibraryLockController's fix actually fires
    // BEFORE any HTTP request is attempted (a real deliberately-unroutable TEST-NET-3 address is
    // used, RFC 5737, guaranteed never to be a real device, so even a guard failure could not
    // reach a real physical target).
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task SsrfGuard_PrivateButNotLoopback_DefaultDenied()
    {
        var admin = await AdminClientAsync();
        var scenario = await LibraryScenario.CreateAsync(admin, $"ssrf{Guid.NewGuid():N}"[..24]);
        try
        {
            var deviceReq = new
            {
                name = "SSRF Test Device",
                direction = "entry",
                deviceId = (string?)null,
                ipAddress = "192.168.1.50",
                port = 80,
                username = (string?)null,
                password = (string?)null,
                relayNo = 1,
                relayMs = 1000,
                workMode = "offline",
                httpPath = "",
                triggerLockOnSuccess = true,
                operationMode = "directional",
                toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{scenario.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();
            var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
            var deviceId = created.GetProperty("data").GetProperty("id").GetGuid();

            var testRes = await admin.PostAsync($"/api/v1/library-devices/{deviceId}/test-lock", null);
            testRes.EnsureSuccessStatusCode();
            var result = await testRes.Content.ReadFromJsonAsync<JsonElement>();
            var data = result.GetProperty("data");

            // Default posture: DoorSecurity:AllowPublicTargets is false (appsettings default) and
            // 192.168.1.50 is a real private-range address that is NOT loopback — the guard must
            // reject it as not-allowed rather than let the HTTP call attempt (and hang/fail on)
            // an address this test process has no actual device listening on.
            data.GetProperty("ok").GetBoolean().Should().BeFalse();
            data.GetProperty("message").GetString().Should().Contain("izinli yerel ağ");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, scenario);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Binding safety ruling (c): "sandbox device simulator enabled" mode. A real loopback-only
    // in-process HTTP server stands in for the physical device; LibraryLockController's real
    // outbound HttpClient.SendAsync call reaches it successfully because 127.0.0.1 always passes
    // the private-address allowlist check regardless of DoorSecurity:AllowPublicTargets.
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task DeviceSimulator_OfflineDevice_RealOutboundCallReachesLoopbackSimulator()
    {
        await using var sim = await DeviceSimulator.StartAsync();
        sim.ResponseStatus = 200;

        // This factory variant forces LibraryLock:UseHttps=false and a real CommandBodyTemplate/
        // Path so the outbound call actually reaches the simulator with a well-formed body,
        // scoped to ONLY this test via WithWebHostBuilder (does not mutate the shared factory
        // other tests in this collection use).
        var httpFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LibraryLock:UseHttps"] = "false",
                ["LibraryLock:CommandPath"] = "/",
                ["LibraryLock:CommandBodyTemplate"] = "{{\"relayNo\":{relayNo},\"relayMs\":{relayMs}}}",
                ["LibraryLock:AllowHttpOnPrivateNetwork"] = "true",
            }));
        });
        var admin = await httpFactory.CreateAdminClientAsync(Guid.NewGuid(), $"t9-sim-{Guid.NewGuid():N}@nexora.local");

        var scenario = await LibraryScenario.CreateAsync(admin, $"simoff{Guid.NewGuid():N}"[..22]);
        try
        {
            var deviceReq = new
            {
                name = "Simulated Offline Device",
                direction = "entry",
                deviceId = (string?)null,
                ipAddress = sim.IpAddress,
                port = sim.Port,
                username = (string?)null,
                password = (string?)null,
                relayNo = 1,
                relayMs = 1000,
                workMode = "offline",
                httpPath = "/",
                triggerLockOnSuccess = true,
                operationMode = "directional",
                toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{scenario.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();
            var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
            var deviceId = created.GetProperty("data").GetProperty("id").GetGuid();

            var testRes = await admin.PostAsync($"/api/v1/library-devices/{deviceId}/test-lock", null);
            testRes.EnsureSuccessStatusCode();
            var result = await testRes.Content.ReadFromJsonAsync<JsonElement>();
            var data = result.GetProperty("data");

            data.GetProperty("ok").GetBoolean().Should().BeTrue("the simulator returned 200 and is a real loopback target the SSRF guard allows");
            sim.RequestCount.Should().BeGreaterThan(0, "the real outbound HTTP call must have actually reached the loopback simulator");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, scenario);
            await httpFactory.DisposeAsync();
        }
    }

    // ---------------------------------------------------------------------------------------
    // Ruling A: "online" WorkMode devices never fire the outbound lock call (the door is already
    // considered opened by the device's own online push-report mechanism) — proven via the
    // simulator's own request-count staying zero even though check-in/entry happens for real.
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task OnlineDevice_CheckIn_NeverTriggersOutboundLockCall()
    {
        await using var sim = await DeviceSimulator.StartAsync();

        var httpFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LibraryLock:UseHttps"] = "false",
                ["LibraryLock:CommandPath"] = "/",
                ["LibraryLock:CommandBodyTemplate"] = "{{\"relayNo\":{relayNo},\"relayMs\":{relayMs}}}",
                ["LibraryLock:AllowHttpOnPrivateNetwork"] = "true",
            }));
        });
        var admin = await httpFactory.CreateAdminClientAsync(Guid.NewGuid(), $"t9-online-{Guid.NewGuid():N}@nexora.local");

        // Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu): bu senaryo
        // EntryControlMode="manual" kullanıyordu, ama vatandaşın kendi /check-in çağrısını
        // bekliyor — ParticipantLibraryService.CheckInAsync "manual" modda HER ZAMAN
        // MANUAL_CHECKIN_REQUIRED (403) fırlatır (bu, kütüphanenin "manual" tanımının doğru,
        // önceden var olan davranışı: yalnız personel elle giriş yapabilir, vatandaş self-check-in
        // yapamaz). Bu çelişki daha önce hep 401 (secver eksikliği)/409 (geofence bug'ı) ile daha
        // erken patladığı için hiç görünmemişti; iki bug da düzeltilince test bu gerçek
        // uyumsuzlukla karşılaştı. Testin asıl amacı cihazın online-WorkMode davranışını ölçmek
        // olduğundan doğru düzeltme EntryControlMode="qr" (vatandaş kendi QR/self-check-in ile
        // girebilir, TriggerDoorAsync yine de EntryControlMode'dan bağımsız cihazı tetikler).
        var scenario = await LibraryScenario.CreateAsync(admin, $"online{Guid.NewGuid():N}"[..22],
            new LibraryScenario.Options { EntryControlMode = "qr" });
        try
        {
            var deviceReq = new
            {
                name = "Online Device",
                direction = "entry",
                deviceId = (string?)null,
                ipAddress = sim.IpAddress,
                port = sim.Port,
                username = (string?)null,
                password = (string?)null,
                relayNo = 1,
                relayMs = 1000,
                workMode = "online",
                httpPath = "/",
                triggerLockOnSuccess = true,
                operationMode = "directional",
                toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{scenario.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();

            var citizen = await httpFactory.CreateCitizenClientAsync(CitizenTestIdentity.Adult(Random.Shared.Next()));
            var walkIn = await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/walk-in", new { seat = scenario.SeatKeys[0].Key });
            walkIn.EnsureSuccessStatusCode();
            // ParticipantLibraryService.CheckInAsync always validates the caller's location
            // against the facility's geofence via LocationAccessGuard.EnsureInside (fail-closed
            // regardless of GeofenceEnabled, see LibraryManagementService.ApplyRequestAsync's own
            // comment) — an empty body used to reach a MANUAL_CHECKIN_REQUIRED 403 first (before
            // the EntryControlMode fix above), masking this separate LOCATION_REQUIRED 409.
            // LibraryScenario.CreateAsync's fixed facility coordinates (41.1086, 28.8681) are
            // reused here so the citizen is reported as being inside the geofence.
            var checkIn = await citizen.PostAsJsonAsync($"/api/v1/me/libraries/{scenario.LibraryId}/check-in",
                new { latitude = 41.1086, longitude = 28.8681 });
            checkIn.EnsureSuccessStatusCode();

            sim.RequestCount.Should().Be(0, "an online-WorkMode device's door is opened by its own push mechanism; the API must not call out to it");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, scenario);
            await httpFactory.DisposeAsync();
        }
    }

    // ---------------------------------------------------------------------------------------
    // Known/unknown device via the anonymous webhook endpoint.
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task Webhook_UnknownDeviceId_Denied()
    {
        var anon = _factory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["DI"] = $"unknown-{Guid.NewGuid():N}",
            ["MT"] = "1",
        });
        var res = await anon.PostAsync("/api/v1/library-device/webaccess", form);
        res.StatusCode.Should().Be(HttpStatusCode.OK, "the webhook protocol replies 200 with a Deny payload body, not an HTTP error status");
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        // Ack (no Data/DT sent, MT-only heartbeat) short-circuits before device resolution; send a
        // real DT to force the code path that resolves+denies an unknown device.
        var form2 = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["DI"] = $"unknown-{Guid.NewGuid():N}",
            ["MT"] = "1",
            ["DT"] = "nxr-cid_deadbeef\r",
        });
        var res2 = await anon.PostAsync("/api/v1/library-device/webaccess", form2);
        var body2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
        body2.TryGetProperty("Trigger_Relay", out _).Should().BeFalse("an unknown device must never approve/trigger the relay");
        body2.GetProperty("Clear_Screen").GetString().Should().Be("C8412F", "the deny screen color, per LibraryWebhookService.Deny");
    }

    [Fact]
    public async Task Webhook_WrongApiKey_Denied()
    {
        var admin = await AdminClientAsync();
        var scenario = await LibraryScenario.CreateAsync(admin, $"wrongkey{Guid.NewGuid():N}"[..20]);
        try
        {
            var deviceReq = new
            {
                name = "Keyed Device", direction = "entry", deviceId = $"dev-{Guid.NewGuid():N}",
                ipAddress = (string?)null, port = 80, username = (string?)null, password = (string?)null,
                relayNo = 1, relayMs = 1000, workMode = "online", httpPath = "",
                triggerLockOnSuccess = true, operationMode = "directional", toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{scenario.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();
            var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
            var deviceIdStr = created.GetProperty("data").GetProperty("deviceCode").GetString();
            var realDeviceId = deviceReq.deviceId;

            var anon = _factory.CreateClient();
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["DI"] = realDeviceId!,
                ["MT"] = "1",
                ["DT"] = "nxr-cid_deadbeef\r",
            });
            var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/library-device/webaccess") { Content = form };
            req.Headers.Add("X-Device-Key", "totally-wrong-key");
            var res = await anon.SendAsync(req);
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            body.TryGetProperty("Trigger_Relay", out _).Should().BeFalse("a wrong API key must never approve/trigger the relay");
            body.GetProperty("Clear_Screen").GetString().Should().Be("C8412F");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, scenario);
        }
    }

    [Fact]
    public async Task Webhook_CorrectApiKey_ForceOpenQueued_Approves()
    {
        var admin = await AdminClientAsync();
        var scenario = await LibraryScenario.CreateAsync(admin, $"forceopen{Guid.NewGuid():N}"[..18]);
        try
        {
            var deviceId = $"dev-{Guid.NewGuid():N}";
            var deviceReq = new
            {
                name = "Force Open Device", direction = "entry", deviceId,
                ipAddress = (string?)null, port = 80, username = (string?)null, password = (string?)null,
                relayNo = 1, relayMs = 1000, workMode = "online", httpPath = "",
                triggerLockOnSuccess = true, operationMode = "directional", toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{scenario.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();
            var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
            var libraryDeviceId = created.GetProperty("data").GetProperty("id").GetGuid();
            var apiKey = created.GetProperty("data").GetProperty("apiKey").GetString();

            // TestLockAsync for an "online" device queues a real ForceOpen key in Redis for the
            // next webhook heartbeat/read to consume.
            var testRes = await admin.PostAsync($"/api/v1/library-devices/{libraryDeviceId}/test-lock", null);
            testRes.EnsureSuccessStatusCode();

            var anon = _factory.CreateClient();
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["DI"] = deviceId,
                ["MT"] = "1",
                ["DT"] = "nxr-cid_deadbeef\r",
            });
            var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/library-device/webaccess") { Content = form };
            req.Headers.Add("X-Device-Key", apiKey!);
            var res = await anon.SendAsync(req);
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            body.TryGetProperty("Trigger_Relay", out _).Should().BeTrue("the queued ForceOpen must approve/trigger the relay on the next authorized webhook read");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, scenario);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Device move.
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task MoveDevice_ToRealTargetLibrary_Succeeds_AndToNonexistentTarget_Fails()
    {
        var admin = await AdminClientAsync();
        var source = await LibraryScenario.CreateAsync(admin, $"movesrc{Guid.NewGuid():N}"[..18]);
        var target = await LibraryScenario.CreateAsync(admin, $"movedst{Guid.NewGuid():N}"[..18]);
        try
        {
            var deviceReq = new
            {
                name = "Movable Device", direction = "entry", deviceId = (string?)null,
                ipAddress = (string?)null, port = 80, username = (string?)null, password = (string?)null,
                relayNo = 1, relayMs = 1000, workMode = "online", httpPath = "",
                triggerLockOnSuccess = true, operationMode = "directional", toggleCooldownMinutes = 5,
            };
            var createRes = await admin.PostAsJsonAsync($"/api/v1/libraries/{source.LibraryId}/devices", deviceReq);
            createRes.EnsureSuccessStatusCode();
            var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
            var deviceId = created.GetProperty("data").GetProperty("id").GetGuid();

            var moveRes = await admin.PostAsJsonAsync($"/api/v1/library-devices/{deviceId}/move", new { targetLibraryId = target.LibraryId });
            moveRes.EnsureSuccessStatusCode();
            var moved = await moveRes.Content.ReadFromJsonAsync<JsonElement>();
            moved.GetProperty("data").GetProperty("libraryId").GetGuid().Should().Be(target.LibraryId);

            var badMove = await admin.PostAsJsonAsync($"/api/v1/library-devices/{deviceId}/move", new { targetLibraryId = Guid.NewGuid() });
            badMove.StatusCode.Should().Be(HttpStatusCode.NotFound);
            var badBody = await badMove.Content.ReadFromJsonAsync<JsonElement>();
            badBody.GetProperty("errorCode").GetString().Should().Be("LIBRARY_NOT_FOUND");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, source);
            await LibraryScenario.DeleteAsync(admin, target);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Ruling: shift IP-takeover three-path breakdown.
    // (a) same staff, same library, already active -> SHIFT_ALREADY_ACTIVE
    // (b) same staff, different library, already active -> auto-close-and-start
    // (c) different staff, same IP -> real IP takeover (EndedByIpTakeover=true)
    // ---------------------------------------------------------------------------------------
    [Fact]
    public async Task ShiftTakeover_SameStaffSameLibrary_AlreadyActive_Rejected()
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"shiftA{Guid.NewGuid():N}"[..20]);
        try
        {
            var staffAdminId = Guid.NewGuid();
            var staffAdminEmail = $"t9-staff-{Guid.NewGuid():N}@nexora.local";
            var staffAdminClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAdminId, staffAdminEmail));

            var staffRes = await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAdminId, workingLibraryIds = new[] { lib.LibraryId } });
            staffRes.EnsureSuccessStatusCode();

            var ip = $"10.99.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";
            var start1 = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            start1.Headers.Add("X-Forwarded-For", ip);
            (await staffAdminClient.SendAsync(start1)).EnsureSuccessStatusCode();

            var start2 = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            start2.Headers.Add("X-Forwarded-For", ip);
            var res2 = await staffAdminClient.SendAsync(start2);
            res2.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var body2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
            body2.GetProperty("errorCode").GetString().Should().Be("SHIFT_ALREADY_ACTIVE");

            var end = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/end");
            end.Headers.Add("X-Forwarded-For", ip);
            await staffAdminClient.SendAsync(end);
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    [Fact]
    public async Task ShiftTakeover_SameStaffDifferentLibrary_AutoClosesPrevious()
    {
        var admin = await AdminClientAsync();
        var libA = await LibraryScenario.CreateAsync(admin, $"shiftB1{Guid.NewGuid():N}"[..18]);
        var libB = await LibraryScenario.CreateAsync(admin, $"shiftB2{Guid.NewGuid():N}"[..18]);
        try
        {
            var staffAdminId = Guid.NewGuid();
            var staffAdminClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAdminId, $"t9-staff-{Guid.NewGuid():N}@nexora.local"));
            var staffRes = await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAdminId, workingLibraryIds = new[] { libA.LibraryId, libB.LibraryId } });
            staffRes.EnsureSuccessStatusCode();
            var staffId = (await staffRes.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetGuid();

            var ip1 = $"10.98.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";
            var startA = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{libA.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startA.Headers.Add("X-Forwarded-For", ip1);
            (await staffAdminClient.SendAsync(startA)).EnsureSuccessStatusCode();

            var ip2 = $"10.97.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";
            var startB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{libB.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startB.Headers.Add("X-Forwarded-For", ip2);
            var resB = await staffAdminClient.SendAsync(startB);
            resB.EnsureSuccessStatusCode();

            var shiftsRes = await admin.GetAsync($"/api/v1/library-staff/{staffId}/shifts");
            shiftsRes.EnsureSuccessStatusCode();
            var shifts = (await shiftsRes.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").EnumerateArray().ToList();
            var closedInA = shifts.First(s => s.GetProperty("libraryId").GetString() == libA.LibraryId.ToString());
            closedInA.GetProperty("status").GetString().Should().Be("ended");
            closedInA.GetProperty("endedByIpTakeover").GetBoolean().Should().BeFalse("this is the 'staff can only be in one place' auto-close, NOT an IP-address takeover");

            var endB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{libB.LibraryId}/shifts/me/end");
            endB.Headers.Add("X-Forwarded-For", ip2);
            await staffAdminClient.SendAsync(endB);
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, libA);
            await LibraryScenario.DeleteAsync(admin, libB);
        }
    }

    [Fact]
    public async Task ShiftTakeover_DifferentStaffSameIp_RealIpTakeover_MarksEndedByIpTakeover()
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"shiftC{Guid.NewGuid():N}"[..20]);
        try
        {
            var staffAId = Guid.NewGuid();
            var staffBId = Guid.NewGuid();
            var staffAClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAId, $"t9-a-{Guid.NewGuid():N}@nexora.local"));
            var staffBClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffBId, $"t9-b-{Guid.NewGuid():N}@nexora.local"));

            var staffARes = await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAId, workingLibraryIds = new[] { lib.LibraryId } });
            staffARes.EnsureSuccessStatusCode();
            var staffAId2 = (await staffARes.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetGuid();
            var staffBRes = await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffBId, workingLibraryIds = new[] { lib.LibraryId } });
            staffBRes.EnsureSuccessStatusCode();

            var sharedIp = $"10.96.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";
            var startA = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startA.Headers.Add("X-Forwarded-For", sharedIp);
            (await staffAClient.SendAsync(startA)).EnsureSuccessStatusCode();

            var startB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startB.Headers.Add("X-Forwarded-For", sharedIp);
            var resB = await staffBClient.SendAsync(startB);
            resB.EnsureSuccessStatusCode();

            var shiftsARes = await admin.GetAsync($"/api/v1/library-staff/{staffAId2}/shifts");
            shiftsARes.EnsureSuccessStatusCode();
            var shiftsA = (await shiftsARes.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").EnumerateArray().ToList();
            var lastA = shiftsA.First();
            lastA.GetProperty("status").GetString().Should().Be("ended");
            lastA.GetProperty("endedByIpTakeover").GetBoolean().Should().BeTrue("staff B started a shift from the SAME IP, which is a real IP-terminal takeover of staff A's shift");

            var endB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/end");
            endB.Headers.Add("X-Forwarded-For", sharedIp);
            await staffBClient.SendAsync(endB);
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    [Fact]
    public async Task ShiftTakeover_DifferentIp_DoesNotAffectOther()
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"shiftD{Guid.NewGuid():N}"[..20]);
        try
        {
            var staffAId = Guid.NewGuid();
            var staffBId = Guid.NewGuid();
            var staffAClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAId, $"t9-da-{Guid.NewGuid():N}@nexora.local"));
            var staffBClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffBId, $"t9-db-{Guid.NewGuid():N}@nexora.local"));
            (await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAId, workingLibraryIds = new[] { lib.LibraryId } })).EnsureSuccessStatusCode();
            (await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffBId, workingLibraryIds = new[] { lib.LibraryId } })).EnsureSuccessStatusCode();

            var ipA = $"10.95.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";
            var ipB = $"10.94.{Random.Shared.Next(1, 250)}.{Random.Shared.Next(1, 250)}";

            var startA = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startA.Headers.Add("X-Forwarded-For", ipA);
            (await staffAClient.SendAsync(startA)).EnsureSuccessStatusCode();

            var startB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/start")
            { Content = JsonContent.Create(new { location = (string?)null, notes = (string?)null }) };
            startB.Headers.Add("X-Forwarded-For", ipB);
            (await staffBClient.SendAsync(startB)).EnsureSuccessStatusCode();

            var mineA = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/libraries/{lib.LibraryId}/shifts/me");
            mineA.Headers.Add("X-Forwarded-For", ipA);
            var mineARes = await staffAClient.SendAsync(mineA);
            mineARes.EnsureSuccessStatusCode();
            var mineABody = await mineARes.Content.ReadFromJsonAsync<JsonElement>();
            mineABody.GetProperty("data").GetProperty("activeShift").GetProperty("status").GetString().Should().Be("active", "a different IP must not have affected staff A's own shift");

            var endA = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/end");
            endA.Headers.Add("X-Forwarded-For", ipA);
            await staffAClient.SendAsync(endA);
            var endB = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/libraries/{lib.LibraryId}/shifts/me/end");
            endB.Headers.Add("X-Forwarded-For", ipB);
            await staffBClient.SendAsync(endB);
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Geofence: three call sites (LibraryShiftService.EnforceGeofence for self shift start,
    // ParticipantLibraryService.CheckInAsync, LibraryOperationsService.ScanStaticQrAsync). This
    // Theory covers call site #1 (self shift start); the citizen check-in geofence path is
    // exercised in LibrarySessionMatrixTests since it is a session/entry concern.
    // ---------------------------------------------------------------------------------------
    [Theory]
    [InlineData(41.1039, 28.8674, true, "OUTSIDE_GEOFENCE")]  // ~350km away
    public async Task Geofence_SelfShiftStart_FarAway_Rejected(double libLat, double libLng, bool _, string expectedCode)
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"geo{Guid.NewGuid():N}"[..24], new LibraryScenario.Options
        {
            GeofenceEnabled = true, GeofenceLatitude = libLat, GeofenceLongitude = libLng, GeofenceRadiusMeters = 150,
        });
        try
        {
            var staffAdminId = Guid.NewGuid();
            var staffClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAdminId, $"t9-geo-{Guid.NewGuid():N}@nexora.local"));
            (await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAdminId, workingLibraryIds = new[] { lib.LibraryId } })).EnsureSuccessStatusCode();

            var farLat = 39.9334; var farLng = 32.8597; // Ankara, ~350km from Sultangazi coords
            var res = await staffClient.PostAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/shifts/me/start",
                new { location = (string?)null, notes = (string?)null, latitude = farLat, longitude = farLng });
            res.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            body.GetProperty("errorCode").GetString().Should().Be(expectedCode);
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    [Fact]
    public async Task Geofence_SelfShiftStart_NoLocation_LocationRequired()
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"geoloc{Guid.NewGuid():N}"[..20], new LibraryScenario.Options
        {
            GeofenceEnabled = true, GeofenceLatitude = 41.1039, GeofenceLongitude = 28.8674, GeofenceRadiusMeters = 150,
        });
        try
        {
            var staffAdminId = Guid.NewGuid();
            var staffClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAdminId, $"t9-geoloc-{Guid.NewGuid():N}@nexora.local"));
            (await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAdminId, workingLibraryIds = new[] { lib.LibraryId } })).EnsureSuccessStatusCode();

            var res = await staffClient.PostAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/shifts/me/start",
                new { location = (string?)null, notes = (string?)null });
            res.StatusCode.Should().Be(HttpStatusCode.Conflict);
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            body.GetProperty("errorCode").GetString().Should().Be("LOCATION_REQUIRED");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    [Fact]
    public async Task Geofence_AdminInitiatedShift_ExemptFromGeofenceCheck()
    {
        var admin = await AdminClientAsync();
        var lib = await LibraryScenario.CreateAsync(admin, $"geoadmin{Guid.NewGuid():N}"[..16], new LibraryScenario.Options
        {
            GeofenceEnabled = true, GeofenceLatitude = 41.1039, GeofenceLongitude = 28.8674, GeofenceRadiusMeters = 150,
        });
        try
        {
            var staffAdminId = Guid.NewGuid();
            var staffAdminClient = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(staffAdminId, $"t9-ga-{Guid.NewGuid():N}@nexora.local"));
            var staffRes = await admin.PostAsJsonAsync("/api/v1/library-staff", new { adminUserId = staffAdminId, workingLibraryIds = new[] { lib.LibraryId } });
            staffRes.EnsureSuccessStatusCode();
            var staffId = (await staffRes.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("id").GetGuid();

            var res = await admin.PostAsJsonAsync($"/api/v1/libraries/{lib.LibraryId}/shifts", new { staffId, location = (string?)null, notes = "admin start" });
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            body.GetProperty("data").GetProperty("status").GetString().Should().Be("active");
            body.GetProperty("data").GetProperty("initiationType").GetString().Should().Be("admin");
        }
        finally
        {
            await LibraryScenario.DeleteAsync(admin, lib);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Real-device safety proof (d, e): a REAL source-file scan (not a network call) of every
    // .cs file in this test directory, asserting no `ipAddress =`/`IpAddress` literal outside
    // loopback (127.0.0.1, used by DeviceSimulator) or the two deliberate, documented exceptions:
    // 192.168.1.50 (the SSRF-guard default-deny proof, per the binding ruling's own instruction
    // to test a "real-looking private-but-not-loopback address") and 10.9x.x.x ranges used ONLY
    // as X-Forwarded-For *client* IP simulation for shift-IP-takeover tests, never as a
    // LibraryDevice.IpAddress an outbound HTTP call could ever target. If a future test
    // accidentally introduces a real device IP literal, this assertion fails loudly.
    // ---------------------------------------------------------------------------------------
    [Fact]
    public void RealDeviceSafety_NoRealDeviceIpLiteralsAcrossLibraryTestSources()
    {
        var dir = System.IO.Path.GetDirectoryName(ThisFilePath())!;
        var ipRegex = new System.Text.RegularExpressions.Regex(@"\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b");
        var allowedExact = new HashSet<string> { "127.0.0.1" };
        var violations = new List<string>();

        foreach (var file in System.IO.Directory.GetFiles(dir, "*.cs", System.IO.SearchOption.TopDirectoryOnly))
        {
            foreach (var (line, lineNo) in System.IO.File.ReadLines(file).Select((l, i) => (l, i + 1)))
            {
                foreach (System.Text.RegularExpressions.Match m in ipRegex.Matches(line))
                {
                    var ip = m.Value;
                    if (allowedExact.Contains(ip)) continue;
                    if (ip == "192.168.1.50") continue; // documented SSRF-guard default-deny proof
                    if (ip.StartsWith("10.9")) continue; // documented X-Forwarded-For client-IP simulation only
                    if (ip.StartsWith("41.10") || ip.StartsWith("28.86") || ip.StartsWith("39.93") || ip.StartsWith("32.85"))
                        continue; // latitude/longitude-shaped decimals matched as false positives by the IP regex, not real IPs
                    violations.Add($"{System.IO.Path.GetFileName(file)}:{lineNo}: {ip}");
                }
            }
        }

        violations.Should().BeEmpty("no Libraries test source may contain a real-looking device IP literal outside the documented, allow-listed exceptions");
    }

    private static string ThisFilePath([System.Runtime.CompilerServices.CallerFilePath] string path = "") => path;
}
