using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Contracts;

// Enumerates the REAL runtime EndpointDataSource of the hosted API and asserts the reviewed
// production contract count. Two runtime routes are NOT part of the reviewed production
// contract and are each excluded explicitly, with justification, so the count cannot drift
// silently:
//
//   1. /api/v1/test-support/residue  -> test-infrastructure only. Task 3 mapped this under the
//      Testing environment exclusively (Program only calls MapTestSupportEndpoints when
//      TestSupportEndpoints.IsEnabled(env) is true). It must be ABSENT under any non-Testing
//      configuration; proven by Test_support_routes_are_absent_under_non_testing_configuration.
//
//   2. /health/ready (DisplayName "Health checks") -> ASP.NET framework diagnostic endpoint
//      produced by MapHealthChecks, not an application contract route. It is present in every
//      environment. The reviewed inventory of 1,678 counts the application contract routes,
//      not this framework diagnostic probe.
//
// After excluding exactly those two, the production-contract catalog must be exactly 1,678.
[Collection(ApiCollection.Name)]
public sealed class EndpointCatalogTests
{
    // Binding endpoint-count ruling (Task 5 brief): the reviewed production contract catalog is
    // exactly 1,678 runtime RouteEndpoints after the explicit exclusions below.
    // Exclusion/count logic now lives in the shared EndpointCatalog helper (Task 6 refactor) so
    // EndpointAuthorizationMatrixTests/EndpointValidationMatrixTests reuse it verbatim instead of
    // reimplementing IsTestSupport/IsFrameworkDiagnostic a second time. Behavior/assertions below
    // are unchanged from Task 5.
    private const int ReviewedProductionRouteCount = EndpointCatalog.ReviewedProductionRouteCount;

    // The single structurally Testing-only support route introduced by Task 3.
    private const string TestSupportRoutePrefix = "/api/v1/test-support";

    // The ASP.NET framework health-check diagnostic endpoint (MapHealthChecks).
    private const string FrameworkHealthCheckDisplayName = "Health checks";

    private readonly NexoraApiFactory _factory;

    public EndpointCatalogTests(ApiTestHost host) => _factory = host.Factory;

    private static RouteEndpoint[] RouteEndpoints(IServiceProvider services) =>
        EndpointCatalog.AllRoutes(services);

    private static bool IsTestSupport(RouteEndpoint endpoint) => EndpointCatalog.IsTestSupport(endpoint);

    // The framework health-check probe is identified by its framework-assigned display name so
    // an application route that happens to start with /health (GET /health, GET /health/detail)
    // is never misclassified as a diagnostic.
    private static bool IsFrameworkDiagnostic(RouteEndpoint endpoint) => EndpointCatalog.IsFrameworkDiagnostic(endpoint);

    [Fact]
    public void Runtime_endpoint_catalog_matches_reviewed_inventory()
    {
        var routes = RouteEndpoints(_factory.Services);

        var testSupportRoutes = routes.Where(IsTestSupport).ToArray();
        var frameworkDiagnostics = routes.Where(IsFrameworkDiagnostic).ToArray();
        var productionRoutes = EndpointCatalog.ProductionRoutes(_factory.Services);

        var testSupportList = string.Join(", ",
            testSupportRoutes.Select(r => r.RoutePattern.RawText).OrderBy(x => x));
        var diagnosticList = string.Join(", ",
            frameworkDiagnostics.Select(r => r.RoutePattern.RawText).OrderBy(x => x));

        // The Testing host must expose the Task 3 residue support route(s): they are excluded
        // from the production contract but listed here as explicit, justified test infrastructure.
        testSupportRoutes.Should().ContainSingle(
            "Task 3 mapped exactly one Testing-only /api/v1/test-support/* residue endpoint under the Testing host")
            .Which.RoutePattern.RawText.Should().Be($"{TestSupportRoutePrefix}/residue");

        // The framework health-check diagnostic is excluded explicitly, as permitted by the brief.
        frameworkDiagnostics.Should().ContainSingle(
            "the only excluded framework diagnostic is the MapHealthChecks probe (/health/ready)")
            .Which.RoutePattern.RawText.Should().Be("/health/ready");

        productionRoutes.Should().HaveCount(ReviewedProductionRouteCount,
            $"reviewed production catalog is exactly {ReviewedProductionRouteCount} routes after excluding " +
            $"the test-infrastructure route(s) [{testSupportList}] and the framework diagnostic route(s) " +
            $"[{diagnosticList}]; raw Testing-host route count was {routes.Length}");
    }

    [Fact]
    public async Task Test_support_routes_are_absent_under_non_testing_configuration()
    {
        await using var production = NexoraApiFactory.CreateForEnvironment("Production");
        await production.InitializeAsync();

        var productionHostRoutes = RouteEndpoints(production.Services);

        productionHostRoutes.Where(IsTestSupport).Should().BeEmpty(
            "the Testing-only test-support endpoint must never be mapped under a non-Testing (Production) configuration");

        // Under Production the Testing-only support route is absent, so the raw catalog equals the
        // reviewed production contract count plus only the framework health-check diagnostic.
        var productionContract = productionHostRoutes
            .Where(r => !IsTestSupport(r) && !IsFrameworkDiagnostic(r))
            .ToArray();

        productionContract.Should().HaveCount(ReviewedProductionRouteCount,
            $"the real Production host must map exactly the {ReviewedProductionRouteCount} reviewed production-contract routes");
    }

    // Task 3 follow-through: exercise the ACTUAL Testing-only residue endpoint over real HTTP
    // against real PostgreSQL. Create a testTag-compatible resource through the public API, prove
    // the residue endpoint finds it, delete it through the public cleanup path, then prove residue
    // is gone. No in-memory provider, mock, or copied model is used on this path.
    [Fact]
    public async Task Residue_endpoint_detects_then_clears_a_tagged_resource_over_real_http()
    {
        var client = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), "residue-admin@nexora.local"));

        var runId = $"task5-residue-{Guid.NewGuid():N}";
        // testTag is the deterministic marker the residue endpoint scans for (Event.Name ILIKE %tag%).
        var testTag = Nexora.Api.Endpoints.TestSupport.TestSupportEndpoints.CreateTestTag(runId);

        // 1) Create a category, then an Event whose Name carries the testTag, all over real HTTP.
        var categoryId = await CreateEventCategoryAsync(client, testTag);
        var eventId = await CreateTaggedEventAsync(client, categoryId, testTag);

        // 2) Prove the residue endpoint finds the tagged resource.
        var found = await QueryResidueAsync(runId);
        found.Should().Contain(r => r.Resource == "Event" && r.Field == "Name",
            "the created Event.Name carries the run's testTag and must be detected as residue");

        // 3) Delete through the public cleanup path: soft-delete (trash) then permanent delete.
        (await client.DeleteAsync($"/api/v1/events/{eventId}"))
            .StatusCode.Should().Be(HttpStatusCode.OK, "soft-delete moves the event to trash");
        (await client.DeleteAsync($"/api/v1/events/{eventId}/permanent"))
            .StatusCode.Should().Be(HttpStatusCode.OK, "permanent delete removes the row from real PostgreSQL");

        // 4) Prove residue is absent after cleanup.
        var afterCleanup = await QueryResidueAsync(runId);
        afterCleanup.Should().NotContain(r => r.Resource == "Event",
            "after the public cleanup path removed the row, no Event residue must remain");
    }

    private sealed record ResidueMatchDto(string Resource, string Field);
    private sealed record ResidueResponseDto(IReadOnlyList<ResidueMatchDto> Residues);
    private sealed record CreatedEnvelope<T>(bool Success, int StatusCode, T Data);
    private sealed record CreatedCategory(Guid Id);
    private sealed record CreatedEvent(Guid Id);

    private static readonly System.Text.Json.JsonSerializerOptions Web =
        new(System.Text.Json.JsonSerializerDefaults.Web);

    private static async Task<Guid> CreateEventCategoryAsync(HttpClient client, string testTag)
    {
        var payload = new { name = $"{testTag}-kategori", description = (string?)null, color = "#3B82F6", defaultPoints = 0 };
        var response = await client.PostAsJsonAsync("/api/v1/event-categories", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = System.Text.Json.JsonSerializer.Deserialize<CreatedEnvelope<CreatedCategory>>(
            await response.Content.ReadAsStringAsync(), Web);
        return body!.Data.Id;
    }

    private static async Task<Guid> CreateTaggedEventAsync(HttpClient client, Guid categoryId, string testTag)
    {
        var start = DateTime.UtcNow.AddDays(3);
        var payload = new
        {
            name = $"{testTag} Etkinlik",
            categoryId,
            venueType = "indoor",
            facilityId = (Guid?)null,
            hallId = (Guid?)null,
            location = (object?)null,
            startDate = start,
            endDate = start.AddHours(2),
            isSingleDay = true,
            gender = "all",
            capacity = 10,
            reserveCapacity = 0,
            minAge = 0,
            maxAge = 0,
            participationPeriod = "once",
            participationLimit = 1,
            description = "task5 residue",
            internalNote = "",
            images = new { },
            access = new
            {
                hasSessions = false,
                hasSeating = false,
                reservationType = "none",
                registrationMode = "none",
                attendanceEnabled = false,
                entryMethod = "none",
                qrEnabled = false,
                qrType = "static",
                qrRotationSeconds = 0,
                kioskEnabled = false,
                turnstileEnabled = false,
                publicLinkEnabled = false,
                publicLinkRequiresPin = false,
                staffIds = Array.Empty<string>(),
            },
            pricing = new { },
            points = new { },
            isActive = true,
            startTime = "10:00",
            endTime = "12:00",
        };

        var response = await client.PostAsJsonAsync("/api/v1/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created,
            $"the tagged event must be created over real HTTP; body: {await response.Content.ReadAsStringAsync()}");
        var body = System.Text.Json.JsonSerializer.Deserialize<CreatedEnvelope<CreatedEvent>>(
            await response.Content.ReadAsStringAsync(), Web);
        return body!.Data.Id;
    }

    private async Task<IReadOnlyList<ResidueMatchDto>> QueryResidueAsync(string runId)
    {
        // Unauthenticated bare client + the test-support API key header (matches the Testing-only
        // endpoint's own auth), hitting the real hosted HTTP interface.
        using var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/test-support/residue?runId={Uri.EscapeDataString(runId)}");
        request.Headers.Add("X-Test-Api-Key", NexoraApiFactory.TestSupportApiKey);

        var response = await client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.OK,
            $"the Testing-only residue endpoint must respond; body: {await response.Content.ReadAsStringAsync()}");
        var body = System.Text.Json.JsonSerializer.Deserialize<ResidueResponseDto>(
            await response.Content.ReadAsStringAsync(), Web);
        return body!.Residues;
    }
}
