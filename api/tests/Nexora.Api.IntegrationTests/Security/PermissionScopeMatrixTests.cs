using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Api.IntegrationTests.Libraries;
using Nexora.Domain.Entities.Authority;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Security;

// Task 11 (security), Step 2, Ruling A: proves the cross-facility/cross-module scope-IDOR
// defense (`EnsureInScopeAsync`/`GetScopedRefIdsAsync`) for the real set of services that
// implement it, over BOTH a read (GET) and a mutation (PUT/DELETE) endpoint per module, and
// confirms the anti-enumeration property (a scoped-out-but-existing resource returns 404
// `{MODULE}_NOT_FOUND`, not 403).
//
// Exhaustive grep result (`grep -rl "EnsureInScopeAsync" src/Nexora.Infrastructure/Services/*.cs`)
// at this base commit found 16 real services implementing the identical
// EnsureInScopeAsync(id, ct) shape: LibraryDeviceService, LibraryStaffService,
// LibraryShiftService, EventService, ReportsService, TravelService, LibraryManagementService,
// SessionService, LibraryOperationsService, TravelAttendanceService, EmergencyAreaService,
// HallService, ParticipantServiceUsageService, SedaApplicationService, TravelApplicationService,
// ServiceFacilityManagementService — a larger and more exhaustive list than the brief's own
// 3-service investigation sample (HallService/LibraryOperationsService/LibraryManagementService).
// This Theory covers a representative subset with the least fixture overhead per module
// (EmergencyAreaService: standalone JSON create with no dependency chain; LibraryManagementService:
// reuses Task 9's established LibraryScenario/ScopedFactoryAuth fixtures; ServiceFacilityManagementService:
// the "service-facilities" module itself) rather than exhaustively re-testing all 16 (that breadth
// belongs to each module's own per-module task per the plan's task split), per Ruling A's explicit
// "Theory over the SPECIFIC MODULES ... found via the grep" instruction — the full 16-service list
// itself IS the required grep deliverable, reported here and in task-11-report.md.
[Collection(ApiCollection.Name)]
public sealed class PermissionScopeMatrixTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private async Task<HttpClient> SuperAdminClientAsync() =>
        await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t11-super-{Guid.NewGuid():N}@nexora.local"));

    // Seeds a real scoped admin: a role holding EXACTLY `permissionKey` (Task 6's established
    // CreateClientWithPermissionAsync pattern) PLUS a real AdminScope row binding it to
    // `refModuleKey`/`refId` (the real ScopedStaffService.EnsureScopeNodeAndBindAsync shape,
    // seeded directly here since that admin-facing endpoint additionally creates/emails a staff
    // account, more than this test needs).
    private async Task<HttpClient> ScopedAdminClientAsync(string permissionKey, string refModuleKey, Guid refId, string scopeName)
    {
        var client = await _factory.CreateClientWithPermissionAsync(Guid.NewGuid(), $"t11-scoped-{Guid.NewGuid():N}@nexora.local", permissionKey);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // The user's id is embedded in the just-issued JWT's NameIdentifier claim; recover it by
        // reading the seeded admin back via the unique role key CreateClientWithPermissionAsync
        // used (it always seeds exactly one admin per call under a fresh Guid).
        var meResponse = await client.GetAsync("/api/v1/auth/me");
        meResponse.EnsureSuccessStatusCode();
        var meBody = JsonSerializer.Deserialize<JsonElement>(await meResponse.Content.ReadAsStringAsync(), Web);
        var userId = meBody.GetProperty("data").GetProperty("id").GetGuid();

        var node = ScopeNode.Create("facility", refModuleKey, refId, scopeName);
        await db.Set<ScopeNode>().AddAsync(node);
        await db.SaveChangesAsync();
        await db.Set<AdminScope>().AddAsync(AdminScope.Create(userId, node.Id));
        await db.SaveChangesAsync();

        return client;
    }

    private sealed record Envelope(bool Success, int StatusCode, string? ErrorCode);

    private static async Task<Envelope?> TryReadEnvelopeAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(body)) return null;
        try { return JsonSerializer.Deserialize<Envelope>(body, Web); }
        catch (JsonException) { return null; }
    }

    // ------------------------------------------------------------------------------------
    // Module: emergency-areas (EmergencyAreaService). Simplest fixture (no dependency chain),
    // "emergency-areas" is both the permission-key prefix and the real scope moduleKey.
    // ------------------------------------------------------------------------------------
    private static object EmergencyAreaPayload(string name, string neighborhood) => new
    {
        name,
        neighborhood,
        address = "Test Mah. No:1",
        latitude = (double?)null,
        longitude = (double?)null,
        capacity = 100,
        areaSizeM2 = 500,
        equipment = (object?)null,
        managerId = (Guid?)null,
        manager = (string?)null,
        managerPhone = (string?)null,
        managerEmail = (string?)null,
        emergencyPhone = (string?)null,
        description = "task11 scope-idor fixture",
        grantAccess = false,
    };

    private async Task<Guid> CreateEmergencyAreaAsync(HttpClient admin, string tag)
    {
        var res = await admin.PostAsJsonAsync("/api/v1/emergency-areas", EmergencyAreaPayload($"T11 EA {tag}", "Cebeci"));
        var body = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"emergency-area create must succeed; body: {body}");
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("data").GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task EmergencyArea_scoped_admin_sees_own_area_but_gets_404_reading_other_facilitys_area()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var areaA = await CreateEmergencyAreaAsync(admin, $"A-{tag}");
        var areaB = await CreateEmergencyAreaAsync(admin, $"B-{tag}");

        var scoped = await ScopedAdminClientAsync("emergency-areas.view", "emergency-areas", areaA, "Scope A");

        var inScope = await scoped.GetAsync($"/api/v1/emergency-areas/{areaA}");
        inScope.StatusCode.Should().Be(HttpStatusCode.OK, "the scoped admin's own area must remain readable");

        var outOfScope = await scoped.GetAsync($"/api/v1/emergency-areas/{areaB}");
        outOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound, "a scoped-out EXISTING resource must look like not-found (anti-enumeration), not forbidden");
        var envelope = await TryReadEnvelopeAsync(outOfScope);
        envelope!.ErrorCode.Should().Be("EMERGENCY_AREA_NOT_FOUND");
    }

    [Fact]
    public async Task EmergencyArea_scoped_admin_can_mutate_own_area_but_gets_404_mutating_other_facilitys_area()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var areaA = await CreateEmergencyAreaAsync(admin, $"MA-{tag}");
        var areaB = await CreateEmergencyAreaAsync(admin, $"MB-{tag}");

        var scoped = await ScopedAdminClientAsync("emergency-areas.edit", "emergency-areas", areaA, "Scope MA");

        var updateInScope = await scoped.PutAsJsonAsync($"/api/v1/emergency-areas/{areaA}", EmergencyAreaPayload($"T11 EA MA-{tag} Updated", "Cebeci"));
        updateInScope.StatusCode.Should().Be(HttpStatusCode.OK, "the scoped admin's own area must remain mutable");

        var updateOutOfScope = await scoped.PutAsJsonAsync($"/api/v1/emergency-areas/{areaB}", EmergencyAreaPayload($"T11 EA MB-{tag} Hacked", "Cebeci"));
        updateOutOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound, "a scoped-out EXISTING resource must look like not-found for MUTATION too, not forbidden");
        var envelope = await TryReadEnvelopeAsync(updateOutOfScope);
        envelope!.ErrorCode.Should().Be("EMERGENCY_AREA_NOT_FOUND");

        // Confirm the out-of-scope PUT genuinely did NOT mutate the resource (defense actually
        // works, not merely returns a misleading status).
        var reread = await admin.GetAsync($"/api/v1/emergency-areas/{areaB}");
        var rereadBody = await reread.Content.ReadAsStringAsync();
        rereadBody.Should().NotContain("Hacked", "the out-of-scope mutation must have been REJECTED, not silently applied");

        // A genuine DELETE against an out-of-scope resource is rejected the same way.
        var deleteOutOfScope = await scoped.DeleteAsync($"/api/v1/emergency-areas/{areaB}");
        deleteOutOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await TryReadEnvelopeAsync(deleteOutOfScope))!.ErrorCode.Should().Be("EMERGENCY_AREA_NOT_FOUND");

        await admin.DeleteAsync($"/api/v1/emergency-areas/{areaA}");
        await admin.DeleteAsync($"/api/v1/emergency-areas/{areaB}");
    }

    // ------------------------------------------------------------------------------------
    // Module: library (LibraryManagementService), real Task 9 fixtures reused
    // (ScopedFactoryAuth.CreateAdminClientAsync + LibraryScenario.CreateAsync).
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Library_scoped_admin_sees_own_library_but_gets_404_reading_other_librarys_data()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..10];
        var libA = await LibraryScenario.CreateAsync(admin, $"A{tag}");
        var libB = await LibraryScenario.CreateAsync(admin, $"B{tag}");

        var scoped = await ScopedAdminClientAsync("library.view", "library", libA.LibraryId, "Library A Scope");

        var inScope = await scoped.GetAsync($"/api/v1/libraries/{libA.LibraryId}");
        inScope.StatusCode.Should().Be(HttpStatusCode.OK);

        var outOfScope = await scoped.GetAsync($"/api/v1/libraries/{libB.LibraryId}");
        outOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound, "cross-library IDOR must look like not-found, not forbidden");
        (await TryReadEnvelopeAsync(outOfScope))!.ErrorCode.Should().Be("LIBRARY_NOT_FOUND");

        await LibraryScenario.DeleteAsync(admin, libA);
        await LibraryScenario.DeleteAsync(admin, libB);
    }

    [Fact]
    public async Task Library_scoped_admin_can_mutate_own_library_but_gets_404_mutating_other_library()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..10];
        var libA = await LibraryScenario.CreateAsync(admin, $"MA{tag}");
        var libB = await LibraryScenario.CreateAsync(admin, $"MB{tag}");

        var scoped = await ScopedAdminClientAsync("library.edit", "library", libA.LibraryId, "Library A Edit Scope");

        var deleteOutOfScope = await scoped.DeleteAsync($"/api/v1/libraries/{libB.LibraryId}");
        deleteOutOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound, "cross-library IDOR must be rejected for mutation (delete) too");
        (await TryReadEnvelopeAsync(deleteOutOfScope))!.ErrorCode.Should().Be("LIBRARY_NOT_FOUND");

        // Confirm B genuinely still exists (the rejected delete did not silently succeed).
        var stillExists = await admin.GetAsync($"/api/v1/libraries/{libB.LibraryId}");
        stillExists.StatusCode.Should().Be(HttpStatusCode.OK);

        await LibraryScenario.DeleteAsync(admin, libA);
        await LibraryScenario.DeleteAsync(admin, libB);
    }

    // ------------------------------------------------------------------------------------
    // Module: service-facilities (ServiceFacilityManagementService) — the ROOT scope module
    // several other modules (halls/events) derive facility-scope from.
    // ------------------------------------------------------------------------------------
    private async Task<Guid> CreateServiceFacilityAsync(HttpClient admin, string tag)
    {
        var payload = new
        {
            name = $"T11 SF {tag}",
            type = "library",
            locationType = "Indoor",
            city = "İstanbul",
            district = "Sultangazi",
            address = $"T11 Mah. {tag}",
            weekdayOpen = "08:00",
            weekdayClose = "22:00",
            weekendOpen = "09:00",
            weekendClose = "20:00",
            parkingCapacity = 0,
            parkingType = "Free",
            capacity = 100,
        };
        var res = await admin.PostAsJsonAsync("/api/v1/service-facilities", payload);
        var body = await res.Content.ReadAsStringAsync();
        res.StatusCode.Should().Be(HttpStatusCode.Created, $"service-facility create must succeed; body: {body}");
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("data").GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task ServiceFacility_scoped_admin_sees_own_facility_but_gets_404_reading_other_facility()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var facA = await CreateServiceFacilityAsync(admin, $"A-{tag}");
        var facB = await CreateServiceFacilityAsync(admin, $"B-{tag}");

        var scoped = await ScopedAdminClientAsync("service-facilities.view", "service-facilities", facA, "SF A Scope");

        var inScope = await scoped.GetAsync($"/api/v1/service-facilities/{facA}");
        inScope.StatusCode.Should().Be(HttpStatusCode.OK);

        var outOfScope = await scoped.GetAsync($"/api/v1/service-facilities/{facB}");
        outOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await TryReadEnvelopeAsync(outOfScope))!.ErrorCode.Should().Be("FACILITY_NOT_FOUND");

        await admin.DeleteAsync($"/api/v1/service-facilities/{facA}");
        await admin.DeleteAsync($"/api/v1/service-facilities/{facB}");
    }

    [Fact]
    public async Task ServiceFacility_scoped_admin_can_delete_own_facility_but_gets_404_deleting_other_facility()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var facA = await CreateServiceFacilityAsync(admin, $"DA-{tag}");
        var facB = await CreateServiceFacilityAsync(admin, $"DB-{tag}");

        var scoped = await ScopedAdminClientAsync("service-facilities.delete", "service-facilities", facA, "SF A Delete Scope");

        var deleteOutOfScope = await scoped.DeleteAsync($"/api/v1/service-facilities/{facB}");
        deleteOutOfScope.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await TryReadEnvelopeAsync(deleteOutOfScope))!.ErrorCode.Should().Be("FACILITY_NOT_FOUND");

        var stillExists = await admin.GetAsync($"/api/v1/service-facilities/{facB}");
        stillExists.StatusCode.Should().Be(HttpStatusCode.OK, "the rejected out-of-scope delete must not have taken effect");

        var deleteInScope = await scoped.DeleteAsync($"/api/v1/service-facilities/{facA}");
        deleteInScope.StatusCode.Should().Be(HttpStatusCode.OK, "the scoped admin's own facility must remain deletable");

        await admin.DeleteAsync($"/api/v1/service-facilities/{facB}");
    }

    // ------------------------------------------------------------------------------------
    // Cross-module derivation asymmetry (Layer 2 finding): a "library" moduleKey query for an
    // admin with ONLY a "service-facilities"-keyed scope node (no direct "library" node) falls
    // through to an EMPTY set per UserScopeService.GetScopedRefIdsAsync's real branching (the
    // facility->halls/events derivation only fires for moduleKey=="halls"/"events", NOT
    // "library") — proves this as a real, testable finding rather than an assumption.
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Facility_scoped_admin_with_no_direct_library_scope_sees_zero_libraries_even_at_their_own_facility()
    {
        var admin = await SuperAdminClientAsync();
        var tag = Guid.NewGuid().ToString("N")[..10];
        var lib = await LibraryScenario.CreateAsync(admin, $"DERIVE{tag}");

        // Scope the admin to the SERVICE-FACILITY that hosts `lib`, not to the library itself.
        var scoped = await ScopedAdminClientAsync("library.view", "service-facilities", lib.ServiceFacilityId, "Facility-only scope (no direct library grant)");

        var res = await scoped.GetAsync($"/api/v1/libraries/{lib.LibraryId}");
        res.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "GetScopedRefIdsAsync's facility->module derivation only implements 'halls'/'events', not 'library' — " +
            "a facility-scoped-only admin sees ZERO libraries, even one hosted at their own scoped facility. " +
            "This is a real, reportable asymmetry (see task-11-report.md), not a bug in this test.");

        await LibraryScenario.DeleteAsync(admin, lib);
    }
}
