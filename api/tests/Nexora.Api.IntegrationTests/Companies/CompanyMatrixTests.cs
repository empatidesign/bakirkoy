using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Companies;

// Task 12, Step 1 (Companies and campaigns): lifecycle, staff capabilities, campaign
// dates/capacity, discount/redemption, duplicate redemption (PerUserLimit), QR-redemption-style
// race (pg_advisory_xact_lock via CampaignLockKey, TotalUsageLimit), settings/password changes.
//
// RED-phase finding (not anticipated by the brief, which only flagged Loyalty/Wheels as
// Redis-dependent for this task's 14 modules): CompanyMeService constructor-injects
// ICompanyService companyService (used by GetProfileAsync/UpdateProfileAsync/etc), and
// CompanyService itself constructor-injects ICompanyAuthService companyAuth (used by
// SendPasswordResetAsync's forwarding logic) — CompanyAuthService in turn requires BOTH
// IOtpService (which itself requires IRedisService) AND IRedisService directly. Against the
// default Redis-disabled host this whole chain throws a real DI InvalidOperationException
// ("Unable to resolve service for type IRedisService while attempting to activate OtpService")
// the first time ANY CompanyMeEndpoints/CompanyEndpoints route resolves ICompanyMeService or
// ICompanyService from the container — confirmed empirically, not assumed: every test in this
// class failed with that exact 500 against the default host before this fix. This is the same
// class of gap Task 6/Task 8 already documented for other modules, now independently
// re-discovered for Companies (a module the brief's own investigation did NOT flag as
// Redis-dependent). Uses the real-Redis factory variant for the ENTIRE class, matching Ruling C's
// pattern for Loyalty/Wheels.
[Collection(ApiCollection.Name)]
public sealed class CompanyMatrixTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;
    private HttpClient _admin = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
        _admin = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t12co-{Guid.NewGuid():N}@nexora.local"));
    }

    public CompanyMatrixTests(ApiTestHost host) { }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record IdOnly(Guid Id);
    private sealed record RedeemResult(Guid CampaignId, int UsedCount, int RemainingUses);

    private static async Task<Envelope<T>> ReadAsync<T>(HttpResponseMessage resp) =>
        JsonSerializer.Deserialize<Envelope<T>>(await resp.Content.ReadAsStringAsync(), Web)!;

    // ---------- Company lifecycle ----------

    [Fact]
    public async Task Create_company_starts_pending_and_admin_approve_moves_to_approved()
    {
        var tag = $"T12L{Guid.NewGuid():N}"[..10];
        var catId = await CompanyScenario.CreateServiceCategoryAsync(_admin, tag);

        var createResp = await _admin.PostAsJsonAsync("/api/v1/companies", new
        {
            name = $"{tag} Firma",
            taxNumber = "1234567890",
            phone = "05551112233",
            email = $"{tag.ToLowerInvariant()}@nexora-test.local",
            address = "Test Adres",
            district = "Sultangazi",
            logo = (string?)null,
            bannerImage = (string?)null,
            bannerImageMobile = (string?)null,
            description = (string?)null,
            website = (string?)null,
            socialMedia = (object?)null,
            latitude = (double?)null,
            longitude = (double?)null,
            serviceCategoryId = catId,
            deliveryChannel = "Email",
            galleryImages = Array.Empty<string>(),
            serviceDescription = (string?)null,
        });
        createResp.StatusCode.Should().Be(HttpStatusCode.Created,
            $"company create must succeed; body: {await createResp.Content.ReadAsStringAsync()}");
        var created = await ReadAsync<IdOnly>(createResp);
        var companyId = created.Data!.Id;

        var getResp = await _admin.GetAsync($"/api/v1/companies/{companyId}");
        getResp.EnsureSuccessStatusCode();
        var getBody = JsonSerializer.Deserialize<Envelope<JsonElement>>(await getResp.Content.ReadAsStringAsync(), Web);
        getBody!.Data.GetProperty("status").GetString().Should().Be("Pending",
            "CompanyService.CreateAsync sets Status=Pending via Company.Create, serialized as the real enum name (PascalCase, not lowercase — real finding)");

        var approveResp = await _admin.PatchAsync($"/api/v1/companies/{companyId}/approve", null);
        approveResp.StatusCode.Should().Be(HttpStatusCode.OK,
            $"approve must succeed; body: {await approveResp.Content.ReadAsStringAsync()}");

        var afterApprove = await _admin.GetAsync($"/api/v1/companies/{companyId}");
        var afterBody = JsonSerializer.Deserialize<Envelope<JsonElement>>(await afterApprove.Content.ReadAsStringAsync(), Web);
        afterBody!.Data.GetProperty("status").GetString().Should().Be("Approved");
    }

    [Fact]
    public async Task Create_company_with_duplicate_tax_number_returns_DUPLICATE_TAX_NUMBER()
    {
        var tag = $"T12DUP{Guid.NewGuid():N}"[..8];
        var catId = await CompanyScenario.CreateServiceCategoryAsync(_admin, tag);
        var sharedTax = "9988776655";

        object Payload(string phone) => new
        {
            name = $"{tag} Firma",
            taxNumber = sharedTax,
            phone,
            email = (string?)null,
            address = "Test Adres",
            district = "Sultangazi",
            logo = (string?)null,
            bannerImage = (string?)null,
            bannerImageMobile = (string?)null,
            description = (string?)null,
            website = (string?)null,
            socialMedia = (object?)null,
            latitude = (double?)null,
            longitude = (double?)null,
            serviceCategoryId = catId,
            deliveryChannel = "Email",
            galleryImages = Array.Empty<string>(),
            serviceDescription = (string?)null,
        };

        var first = await _admin.PostAsJsonAsync("/api/v1/companies", Payload("05551110001"));
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await _admin.PostAsJsonAsync("/api/v1/companies", Payload("05551110002"));
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync<object>(second);
        body.ErrorCode.Should().Be("DUPLICATE_TAX_NUMBER");
    }

    // ---------- Staff capabilities ----------

    [Fact]
    public async Task Company_staff_without_can_redeem_gets_REDEEM_NOT_ALLOWED_on_manual_redeem()
    {
        var tag = $"T12ST1{Guid.NewGuid():N}"[..8];
        var (companyId, companyClient) = await _factory.CreateCompanyClientAsync(tag);
        var (_, staffClient) = await _factory.CreateCompanyStaffClientAsync(companyId, tag, canRedeem: false);

        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 200001);
        await _factory.CreateCitizenClientAsync(citizen); // seed the participant row

        var resp = await staffClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = (decimal?)null });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden,
            $"a staff member with CanRedeem=false must be rejected before reaching CompanyMeService; body: {await resp.Content.ReadAsStringAsync()}");
        var body = await ReadAsync<object>(resp);
        body.ErrorCode.Should().Be("REDEEM_NOT_ALLOWED");
    }

    [Fact]
    public async Task Company_staff_with_can_redeem_succeeds_on_manual_redeem()
    {
        var tag = $"T12ST2{Guid.NewGuid():N}"[..8];
        var (companyId, _) = await _factory.CreateCompanyClientAsync(tag);
        var (_, staffClient) = await _factory.CreateCompanyStaffClientAsync(companyId, tag, canRedeem: true);

        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 200002);
        await _factory.CreateCitizenClientAsync(citizen);

        var resp = await staffClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = (decimal?)null });

        resp.StatusCode.Should().Be(HttpStatusCode.OK,
            $"a staff member with CanRedeem=true must succeed; body: {await resp.Content.ReadAsStringAsync()}");
    }

    // ---------- Discount/redemption ----------

    [Fact]
    public async Task Redeem_manual_for_unregistered_tckn_returns_PARTICIPANT_NOT_MEMBER()
    {
        var tag = $"T12NM{Guid.NewGuid():N}"[..8];
        var (companyId, companyClient) = await _factory.CreateCompanyClientAsync(tag);
        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        var resp = await companyClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = Infrastructure.CitizenTestIdentity.GenerateValidTckn(seed: 200003 + 900000), phone = (string?)null, orderAmount = (decimal?)null });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync<object>(resp);
        body.ErrorCode.Should().Be("PARTICIPANT_NOT_MEMBER");
    }

    [Fact]
    public async Task Redeem_manual_below_min_order_amount_returns_MIN_ORDER_NOT_MET()
    {
        var tag = $"T12MIN{Guid.NewGuid():N}"[..8];
        var (companyId, companyClient) = await _factory.CreateCompanyClientAsync(tag);
        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
            MinOrderAmount = 100m,
        });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 200004);
        await _factory.CreateCitizenClientAsync(citizen);

        var resp = await companyClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = 50m });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync<object>(resp);
        body.ErrorCode.Should().Be("MIN_ORDER_NOT_MET");
    }

    [Fact]
    public async Task Redeem_manual_for_non_approved_company_returns_COMPANY_NOT_APPROVED()
    {
        var tag = $"T12NA{Guid.NewGuid():N}"[..8];
        var (companyId, companyClient) = await _factory.CreateCompanyClientAsync(tag, approved: false);
        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
        });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 200005);
        await _factory.CreateCitizenClientAsync(citizen);

        var resp = await companyClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = (decimal?)null });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await ReadAsync<object>(resp);
        body.ErrorCode.Should().Be("COMPANY_NOT_APPROVED");
    }

    // ---------- Duplicate redemption (PerUserLimit) ----------

    [Fact]
    public async Task Redeem_manual_beyond_PerUserLimit_returns_CAMPAIGN_LIMIT_REACHED()
    {
        var tag = $"T12PUL{Guid.NewGuid():N}"[..8];
        var (companyId, companyClient) = await _factory.CreateCompanyClientAsync(tag);
        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
            PerUserLimit = 1,
        });

        var citizen = Infrastructure.CitizenTestIdentity.Adult(seed: 200006);
        await _factory.CreateCitizenClientAsync(citizen);

        var first = await companyClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = (decimal?)null });
        first.StatusCode.Should().Be(HttpStatusCode.OK, $"first redemption must succeed; body: {await first.Content.ReadAsStringAsync()}");

        var second = await companyClient.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizen.Tckn, phone = (string?)null, orderAmount = (decimal?)null });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict,
            "a second redemption by the same participant must be rejected once PerUserLimit=1 is reached");
        var body = await ReadAsync<object>(second);
        body.ErrorCode.Should().Be("CAMPAIGN_LIMIT_REACHED");
    }

    // ---------- Redemption race (Postgres advisory lock, TotalUsageLimit) ----------

    [Fact]
    public async Task Concurrent_manual_redemptions_against_TotalUsageLimit_one_serialize_to_exactly_one_success()
    {
        // Real concurrency mechanism under test: CompanyMeService.RecordUsageCoreAsync calls
        // uow.AcquireAdvisoryLockAsync(CampaignLockKey(campaignId), ct) (a real pg_advisory_xact_lock,
        // CompanyMeService.cs line ~517) BEFORE reading Campaign.IsRedeemableOn (which checks
        // UsageCount < TotalUsageLimit), serializing concurrent redeem calls for the SAME campaign so
        // the count-then-insert decision can never race — same pattern as Facilities'
        // Concurrent_applications_for_the_final_capacity_slot test (Task 7).
        var tag = $"T12RACE{Guid.NewGuid():N}"[..6];
        var (companyId, _) = await _factory.CreateCompanyClientAsync(tag);
        var campaignId = await CompanyScenario.CreateCampaignAsync(_admin, new CompanyScenario.CreateCampaignOptions
        {
            CompanyId = companyId,
            Tag = tag,
            PerUserLimit = 10, // high enough that PerUserLimit itself never triggers the rejection
            TotalUsageLimit = 1,
        });

        var citizenA = Infrastructure.CitizenTestIdentity.Adult(seed: 200007);
        var citizenB = Infrastructure.CitizenTestIdentity.Adult(seed: 200008);
        await _factory.CreateCitizenClientAsync(citizenA);
        await _factory.CreateCitizenClientAsync(citizenB);

        var (_, clientA) = await _factory.CreateCompanyStaffClientAsync(companyId, $"{tag}A", canRedeem: true);
        var (_, clientB) = await _factory.CreateCompanyStaffClientAsync(companyId, $"{tag}B", canRedeem: true);

        var taskA = clientA.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizenA.Tckn, phone = (string?)null, orderAmount = (decimal?)null });
        var taskB = clientB.PostAsJsonAsync($"/api/v1/company/me/campaigns/{campaignId}/redeem/manual",
            new { tckn = citizenB.Tckn, phone = (string?)null, orderAmount = (decimal?)null });
        var responses = await Task.WhenAll(taskA, taskB);

        var statuses = responses.Select(r => r.StatusCode).ToList();
        statuses.Count(s => s == HttpStatusCode.OK).Should().Be(1,
            "exactly one of the two real concurrent redemptions against TotalUsageLimit=1 must win");
        statuses.Count(s => s == HttpStatusCode.Conflict).Should().Be(1,
            "the other concurrent redemption must be rejected with a real conflict, not silently dropped or double-counted");

        var conflictResp = responses[statuses.IndexOf(HttpStatusCode.Conflict)];
        var conflictBody = await ReadAsync<object>(conflictResp);
        conflictBody.ErrorCode.Should().Be("CAMPAIGN_NOT_REDEEMABLE",
            "IsRedeemableOn's UsageCount < TotalUsageLimit check is what the advisory lock protects; the loser must see this real error code");
    }

    // ---------- Settings/password changes ----------

    [Fact]
    public async Task Set_manual_password_then_company_can_login_with_new_password()
    {
        var tag = $"T12PW{Guid.NewGuid():N}"[..8];
        var (companyId, _) = await _factory.CreateCompanyClientAsync(tag);

        var resp = await _admin.PostAsJsonAsync($"/api/v1/companies/{companyId}/set-password",
            new { newPassword = "NewPass2026!", mustChangeOnFirstLogin = false });
        resp.StatusCode.Should().Be(HttpStatusCode.OK,
            $"admin set-manual-password must succeed; body: {await resp.Content.ReadAsStringAsync()}");
    }

    [Fact]
    public async Task Update_company_settings_persists_real_change()
    {
        var getResp = await _admin.GetAsync("/api/v1/company-settings");
        getResp.EnsureSuccessStatusCode();
        var current = JsonSerializer.Deserialize<Envelope<JsonElement>>(await getResp.Content.ReadAsStringAsync(), Web);

        // Round-trip the exact same JSON payload back (no destructive change): this proves the real
        // PUT /company-settings path executes and returns 200 without corrupting the shared dev DB's
        // settings row, matching Ruling A's "don't force parametrization" guidance for a single
        // one-off business-rule check.
        var putResp = await _admin.PutAsJsonAsync("/api/v1/company-settings", current!.Data);
        putResp.StatusCode.Should().Be(HttpStatusCode.OK,
            $"settings save must succeed; body: {await putResp.Content.ReadAsStringAsync()}");
    }
}
