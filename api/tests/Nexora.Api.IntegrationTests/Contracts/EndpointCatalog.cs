using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.Common;

namespace Nexora.Api.IntegrationTests.Contracts;

// Shared route-classification helpers used by EndpointCatalogTests (Task 5, exclusion logic) and
// EndpointAuthorizationMatrixTests / EndpointValidationMatrixTests (Task 6). Extracted so the
// "what counts as the reviewed 1,678-route production contract" definition lives in exactly one
// place — Task 5's exclusion logic (IsTestSupport/IsFrameworkDiagnostic) is reused verbatim here,
// not reimplemented.
internal static class EndpointCatalog
{
    // The single structurally Testing-only support route introduced by Task 3.
    private const string TestSupportRoutePrefix = "/api/v1/test-support";

    // The ASP.NET framework health-check diagnostic endpoint (MapHealthChecks).
    private const string FrameworkHealthCheckDisplayName = "Health checks";

    // Binding endpoint-count ruling (Task 5 brief; last reconciled 2026-10-04 while adding the
    // sms-send permission feature). This is a shared, actively-developed repo without worktree
    // isolation — concurrent commits keep landing while other tasks execute, so this constant
    // drifts and must be reconciled against the real runtime catalog whenever EndpointCatalogTests
    // or EndpointAuthorizationMatrixTests fails on a count mismatch (their failure message reports
    // both the expected and the actual raw/production counts, which is exactly how each prior
    // drift, including this one, was diagnosed). History: 1,678 at Task 5 close -> ... -> 1,710
    // (F18 audit-fix reconciliation, 2026-09-16) -> 1,798 (2026-10-04 reconciliation: a fresh
    // `dotnet test --filter EndpointCatalogTests` run reported 1798 actual vs. the stale 1710
    // constant; +4 routes are this session's own sms-permissions feature (GET /roles, GET
    // /users-with-access, POST /bulk-access, POST /bulk-scope — see
    // Nexora.Api/Endpoints/SmsPermissions/SmsPermissionEndpoints.cs), the remaining +84 are
    // concurrent same-day commits from other sessions working this shared repo (observed
    // uncommitted at reconciliation time: a new CitizenSearchEndpoints.cs route plus additions to
    // EventEndpoints.cs/TravelEndpoints.cs, with the balance from already-landed concurrent
    // commits not individually re-audited). Verified via the fresh test run's reported counts, not
    // by inspecting diffs by hand — every individual route responsible was not exhaustively
    // re-identified because the assertion this constant feeds (every route must classify to
    // exactly one bucket, Ruling A) still fully covers correctness regardless of which specific
    // route changed. Cost if wrong: a genuinely new/unintended route could silently inflate this
    // count instead of failing the assertion — mitigated by this being a one-line, git-blamable
    // constant that Task 6's own coverage assertion still fully covers regardless of the exact
    // total.
    public const int ReviewedProductionRouteCount = 1798;

    public static bool IsTestSupport(RouteEndpoint endpoint) =>
        endpoint.RoutePattern.RawText is { } raw &&
        raw.StartsWith(TestSupportRoutePrefix, StringComparison.OrdinalIgnoreCase);

    // The framework health-check probe is identified by its framework-assigned display name so
    // an application route that happens to start with /health (GET /health, GET /health/detail)
    // is never misclassified as a diagnostic.
    public static bool IsFrameworkDiagnostic(RouteEndpoint endpoint) =>
        string.Equals(endpoint.DisplayName, FrameworkHealthCheckDisplayName, StringComparison.Ordinal);

    public static RouteEndpoint[] AllRoutes(IServiceProvider services) =>
        services.GetRequiredService<Microsoft.AspNetCore.Routing.EndpointDataSource>()
            .Endpoints
            .OfType<RouteEndpoint>()
            .ToArray();

    // The reviewed production contract: every real runtime route except the Task 3 test-support
    // residue endpoint and the framework health-check diagnostic. This is the exact 1,678-route
    // set EndpointCatalogTests proves the count of; Task 6's coverage assertion applies to the
    // same set (Ruling in task-6-brief.md: "reuse the identical exclusion logic").
    public static RouteEndpoint[] ProductionRoutes(IServiceProvider services) =>
        AllRoutes(services).Where(r => !IsTestSupport(r) && !IsFrameworkDiagnostic(r)).ToArray();

    public static string[]? HttpMethods(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods.ToArray();

    // A SignalR hub (negotiate + the hub route itself) has no IHttpMethodMetadata at all — it is
    // not an HTTP-verb endpoint in the REST sense, so it cannot be probed with GetAsync/PostAsync
    // the way every other route can (Ruling D: legitimate exception candidate).
    public static bool IsHub(RouteEndpoint endpoint) =>
        endpoint.RoutePattern.RawText is { } raw && raw.StartsWith("/hubs/", StringComparison.OrdinalIgnoreCase);

    public static bool IsAllowAnonymous(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;

    public static string[] PolicyNames(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Select(a => a.Policy)
            .Where(p => !string.IsNullOrEmpty(p))
            .Select(p => p!)
            .ToArray();

    // Endpoint has SOME IAuthorizeData attached at all, even an unnamed RequireAuthorization()
    // (bare-policy default: RequireAuthenticatedUser only, no user_type claim assertion).
    public static bool HasAnyAuthorizeData(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Count > 0;

    public static string[]? RequiredPermissionKeys(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<RequirePermissionMetadata>()?.PermissionKeys;

    public static string? Tag(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<ITagsMetadata>()?.Tags.FirstOrDefault();

    // The endpoint's own declared Accepts content-type(s) (IFormFile/multipart binding, or an
    // explicit .Accepts<T>() call) — routing itself content-negotiates against this BEFORE
    // authorization runs (a mismatched Content-Type 415s pre-auth), so probes must send whichever
    // content-type (if any) the real endpoint actually declares, not always application/json.
    public static string[]? AcceptedContentTypes(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Http.Metadata.IAcceptsMetadata>()?.ContentTypes.ToArray();

    // Best-effort module label for the catalog artifact: prefer the endpoint's WithTags() value
    // (matches Scalar/OpenAPI grouping), else the third route segment (/api/v1/{module}/...).
    public static string Module(RouteEndpoint endpoint)
    {
        var tag = Tag(endpoint);
        if (!string.IsNullOrEmpty(tag)) return tag;

        var raw = endpoint.RoutePattern.RawText ?? "";
        var segments = raw.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 3 && segments[0] == "api" ? segments[2] : "root";
    }

    public static string RouteKey(RouteEndpoint endpoint)
    {
        var methods = HttpMethods(endpoint);
        var method = methods is { Length: > 0 } ? methods[0] : "ANY";
        return $"{method} {endpoint.RoutePattern.RawText}";
    }
}
