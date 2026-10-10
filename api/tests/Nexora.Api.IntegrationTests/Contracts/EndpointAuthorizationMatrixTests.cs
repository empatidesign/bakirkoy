using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Application.Common.Interfaces;
using Xunit;

namespace Nexora.Api.IntegrationTests.Contracts;

// Task 6: proves the AUTHORIZATION LAYER ITSELF (the generic cross-cutting policy/permission
// pipeline) is correctly enforced for every real route in the reviewed 1,678-route production
// contract (task-6-brief.md Ruling A). This is NOT per-endpoint business-logic coverage (that is
// Tasks 7-14's job) — it is a generic, data-driven theory that reads each endpoint's REAL declared
// metadata from the live EndpointDataSource, classifies it into exactly one of four buckets, and
// runs the identity probes appropriate to that classification.
//
// Runs against the Redis-ENABLED host (NexoraApiFactory.CreateForCollectionWithRedis) for the
// whole matrix, not just the two Ruling B session cases: several PERMISSION- and
// DEVICE_KEY-classified handlers (LiderTekWebhookService, CitizenIdentityQrService,
// FacilityDeviceService, LibraryDeviceService, DeviceMonitorService, ...) take a constructor
// dependency on IRedisService, which Infrastructure only registers when ConnectionStrings:Redis
// is non-empty — Task 5's Redis-disabled host makes every one of those requests throw a DI
// InvalidOperationException (500) before the handler body runs, which is harmless for the
// "not-401/403" positive assertions but makes the DEVICE_KEY valid-vs-invalid-key distinction
// meaningless. This was a real finding made while implementing this task, not assumed up front.
[Collection(ApiCollection.Name)]
public sealed class EndpointAuthorizationMatrixTests : IAsyncLifetime
{
    private NexoraApiFactory _redisHost = null!;

    public async Task InitializeAsync()
    {
        _redisHost = NexoraApiFactory.CreateForCollectionWithRedis();
        await _redisHost.InitializeAsync();
    }

    public async Task DisposeAsync() => await _redisHost.DisposeAsync();

    private static readonly string ExceptionsPath = Path.Combine(AppContext.BaseDirectory, "Contracts", "endpoint-exceptions.json");

    // ---- Classification (Ruling A) --------------------------------------------------------

    public enum IdentityClass { Public, PolicyOnly, PermissionGated, DeviceApiKey, Exception }

    public sealed record ClassifiedRoute(
        string Method, string Route, IdentityClass Class, string? PolicyName, string[]? PermissionKeys, string Module,
        string? AcceptedContentType);

    // The explicit, hand-enumerated device/API-key route-group list (task-6-brief.md: "there is no
    // single generic device classification available from endpoint metadata alone — enumerate the
    // actual device/API-key route groups by reading the Endpoints/**/*.cs files"). Found by
    // grepping X-Device-Key / X-Api-Key / manual header checks across src/Nexora.Api/Endpoints:
    //   - DeviceEndpoints.cs (LiderTekWebhookService, X-Device-Key/Basic-auth/query/form key)
    //   - LibraryDeviceEndpoints.cs webaccess group + root "/" webaccess (LibraryWebhookService)
    //   - FacilityModuleEndpoints.MapDevices per-module "/devices/checkin" (X-Device-Key header)
    //   - AiCatalogEndpoints.cs + PublicCatalogEndpoints.cs (X-Api-Key via PublicApiKeyFilter)
    private static readonly HashSet<string> DeviceOrApiKeyRoutes = new(StringComparer.Ordinal)
    {
        "POST /api/v1/device/webaccess",
        "POST /api/v1/library-device/webaccess",
        "POST /",
        "POST /api/v1/sports/devices/checkin",
        "POST /api/v1/pool/devices/checkin",
        "POST /api/v1/youth-camp/devices/checkin",
        "POST /api/v1/scout-camp/devices/checkin",
        "POST /api/v1/science-center/devices/checkin",
        "POST /api/v1/kasif/devices/checkin",
        "POST /api/v1/accessible-life/devices/checkin",
        "POST /api/v1/women-family/devices/checkin",
        "GET /api/v1/public/ai-catalog/summary",
        "GET /api/v1/public/ai-catalog/programs",
        "GET /api/v1/public/ai-catalog/libraries",
        "GET /api/v1/public/ai-catalog/halls",
        "GET /api/v1/public/ai-catalog/travels",
        "GET /api/v1/public/ai-catalog/emergency-areas",
        "GET /api/v1/public/ai-catalog/facilities",
        "GET /api/v1/public/service-facilities",
        "GET /api/v1/public/service-facilities/map-points",
        "GET /api/v1/public/service-facilities/{id:guid}",
        "GET /api/v1/public/events",
        "GET /api/v1/public/events/calendar",
        "GET /api/v1/public/events/categories",
        "GET /api/v1/public/events/{id:guid}",
        "GET /api/v1/public/events/{id:guid}/sessions",
    };

    private static ClassifiedRoute Classify(RouteEndpoint endpoint, IReadOnlyList<EndpointException> exceptions)
    {
        var routeKey = EndpointCatalog.RouteKey(endpoint);
        var route = endpoint.RoutePattern.RawText ?? "";
        var method = EndpointCatalog.HttpMethods(endpoint) is { Length: > 0 } m ? m[0] : "ANY";
        var module = EndpointCatalog.Module(endpoint);

        var acceptedContentType = EndpointCatalog.AcceptedContentTypes(endpoint)?.FirstOrDefault();

        if (EndpointCatalog.IsHub(endpoint) || exceptions.Any(e => e.Matches(method, route)))
            return new ClassifiedRoute(method, route, IdentityClass.Exception, null, null, module, acceptedContentType);

        var permissionKeys = EndpointCatalog.RequiredPermissionKeys(endpoint);
        if (permissionKeys is { Length: > 0 })
            return new ClassifiedRoute(method, route, IdentityClass.PermissionGated, null, permissionKeys, module, acceptedContentType);

        if (DeviceOrApiKeyRoutes.Contains(routeKey))
            return new ClassifiedRoute(method, route, IdentityClass.DeviceApiKey, null, null, module, acceptedContentType);

        var isAnonymous = EndpointCatalog.IsAllowAnonymous(endpoint);
        var hasAnyAuthorize = EndpointCatalog.HasAnyAuthorizeData(endpoint);
        if (isAnonymous || !hasAnyAuthorize)
            return new ClassifiedRoute(method, route, IdentityClass.Public, null, null, module, acceptedContentType);

        var policyNames = EndpointCatalog.PolicyNames(endpoint);
        return new ClassifiedRoute(method, route, IdentityClass.PolicyOnly, policyNames.FirstOrDefault(), null, module, acceptedContentType);
    }

    // ---- Step 1-2 (RED): coverage assertion ------------------------------------------------

    [Fact]
    public void Every_production_route_resolves_to_exactly_one_classification_with_no_leftover()
    {
        var routes = EndpointCatalog.ProductionRoutes(_redisHost.Services);
        var exceptions = ExceptionRegistry.Load(ExceptionsPath);
        ExceptionRegistry.EnsureNoneExpired(exceptions, DateOnly.FromDateTime(DateTime.UtcNow));

        routes.Should().HaveCount(EndpointCatalog.ReviewedProductionRouteCount);

        var unclassified = new List<string>();
        var classified = new Dictionary<string, ClassifiedRoute>();
        foreach (var route in routes)
        {
            var routeKey = EndpointCatalog.RouteKey(route);
            ClassifiedRoute result;
            try
            {
                result = Classify(route, exceptions);
            }
            catch (Exception ex)
            {
                unclassified.Add($"{routeKey} -> classification threw: {ex.Message}");
                continue;
            }
            classified[routeKey] = result;
        }

        unclassified.Should().BeEmpty(
            "every real route in the reviewed production catalog must resolve to exactly one " +
            "classification with no unclassifiable leftover; real unclassified routes: " +
            string.Join("\n  ", unclassified));

        classified.Should().HaveCount(routes.Length,
            "each real route must classify to exactly one bucket (no duplicate route+method collisions)");

        // Every classification bucket that exists in the real catalog must have run its identity
        // probes: cross-check against the theory's own MemberData so a bucket can never silently
        // have zero test cases.
        var classCounts = classified.Values.GroupBy(c => c.Class).ToDictionary(g => g.Key, g => g.Count());
        // Cross-check against the FULL unsharded case set, not IdentityProbeCases() directly: when
        // NEXORA_AUTHZ_SHARD_INDEX/COUNT are set for a chunked run, IdentityProbeCases() only
        // yields this process's slice, which would make this coverage assertion falsely fail for
        // classes that exist only in other shards.
        var probedClasses = AllClassifiedRoutesUnsharded().Select(c => c.Class).ToHashSet();
        foreach (var (cls, count) in classCounts)
        {
            if (count > 0 && cls != IdentityClass.Exception)
                probedClasses.Should().Contain(cls, $"classification {cls} has {count} real route(s) but no probe case ran for it");
        }
    }

    // ---- Step 5: export the classified catalog as a CI artifact (Interfaces: endpoint-catalog.json) ---

    // Generated artifact, NOT committed truth (task-6-brief.md Interfaces section): one entry per
    // real route in the reviewed 1,678-route production catalog, with the exact scenarioId that
    // IdentityProbeCases() used for that route's Theory case (or "Exception:METHOD ROUTE" for a
    // documented exception, which never gets a probe case per Ruling D) — so every entry is
    // traceable back to the specific xUnit test case that exercised it, not just a bare count.
    [Fact]
    public void Endpoint_catalog_artifact_is_exported_with_all_1678_production_routes()
    {
        var routes = EndpointCatalog.ProductionRoutes(_redisHost.Services);
        var exceptions = ExceptionRegistry.Load(ExceptionsPath);

        var catalog = routes.Select(route =>
        {
            var c = Classify(route, exceptions);
            var scenarioId = $"{c.Class}:{c.Method} {c.Route}";
            return new
            {
                method = c.Method,
                route = c.Route,
                identityClass = c.Class.ToString(),
                permissionKey = c.PermissionKeys?.FirstOrDefault(),
                module = c.Module,
                scenarioId,
            };
        }).ToArray();

        catalog.Should().HaveCount(EndpointCatalog.ReviewedProductionRouteCount);

        var path = Path.Combine(AppContext.BaseDirectory, "endpoint-catalog.json");
        File.WriteAllText(path, JsonSerializer.Serialize(catalog, new JsonSerializerOptions { WriteIndented = true }));
    }

    // ---- Step 3: identity matrix (Theory/MemberData, one case per real route) --------------

    // Full, deterministic, unsharded classified-route list (one entry per real production route,
    // exceptions excluded) used both as the shard source below and as the coverage cross-check in
    // Every_production_route_resolves_to_exactly_one_classification_with_no_leftover, so that
    // assertion always sees every class regardless of which shard (if any) this process is running.
    public static IReadOnlyList<ClassifiedRoute> AllClassifiedRoutesUnsharded()
    {
        // NexoraApiFactory instances aren't available at MemberData-collection time (no DI scope
        // yet) — this reflects the REAL runtime catalog by booting a throwaway host purely to
        // enumerate+classify routes for test-case generation, matching EndpointCatalogTests'
        // own pattern of booting hosts to inspect the real EndpointDataSource. The actual HTTP
        // probes in the test body use the shared Redis-enabled host from InitializeAsync.
        using var enumerationHost = BuildEnumerationHost();
        var routes = EndpointCatalog.ProductionRoutes(enumerationHost.Services);
        var exceptions = ExceptionRegistry.Load(ExceptionsPath);

        var result = new List<ClassifiedRoute>();
        foreach (var route in routes)
        {
            var c = Classify(route, exceptions);
            if (c.Class == IdentityClass.Exception) continue; // Ruling D: exceptions don't get probes.
            result.Add(c);
        }
        return result;
    }

    public static IEnumerable<object[]> IdentityProbeCases()
    {
        var allRoutes = AllClassifiedRoutesUnsharded();

        // Optional sharding (NEXORA_AUTHZ_SHARD_INDEX/NEXORA_AUTHZ_SHARD_COUNT): this single Theory
        // runs one real HTTP+Postgres round-trip per production route (1,678 cases) in one process,
        // which was observed to take 5-17+ hours on this shared dev machine and to die silently
        // under host memory pressure (see progress.md Task 6 RUN1-RUN4). Sharding lets an external
        // runner (scripts/run-authz-matrix.sh) execute disjoint slices in separate short-lived
        // `dotnet test` processes so memory never accumulates across the full 1,678-case run and a
        // dead shard only has to be re-run for its own slice, not from scratch. Unset/absent means
        // "run everything", so this is fully backward compatible with a single foreground run.
        var shardIndexRaw = Environment.GetEnvironmentVariable("NEXORA_AUTHZ_SHARD_INDEX");
        var shardCountRaw = Environment.GetEnvironmentVariable("NEXORA_AUTHZ_SHARD_COUNT");
        int shardIndex = 0, shardCount = 1;
        if (!string.IsNullOrEmpty(shardIndexRaw) && !string.IsNullOrEmpty(shardCountRaw))
        {
            shardIndex = int.Parse(shardIndexRaw);
            shardCount = int.Parse(shardCountRaw);
            if (shardCount < 1 || shardIndex < 0 || shardIndex >= shardCount)
            {
                throw new InvalidOperationException(
                    $"Invalid NEXORA_AUTHZ_SHARD_INDEX/COUNT: {shardIndexRaw}/{shardCountRaw}");
            }
        }

        var ordinal = 0;
        foreach (var c in allRoutes)
        {
            var scenarioId = $"{c.Class}:{c.Method} {c.Route}";
            // Stable positional sharding over the deterministic route enumeration order (not a
            // hash of scenarioId) so shard membership is trivial to reason about and every route
            // is covered by exactly one shard for a given shardCount.
            if (ordinal % shardCount == shardIndex)
            {
                yield return [c, scenarioId];
            }
            ordinal++;
        }
    }

    private static Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Nexora.Api.Endpoints.TestSupport.ResidueResponse> BuildEnumerationHost()
        // MemberData runs before any [Collection] fixture/constructor executes, so the shared
        // Redis-enabled host from InitializeAsync isn't available yet — this boots a throwaway
        // "Testing" host bound to the SAME collection database purely to read the real
        // EndpointDataSource for test-case generation (route registration in Program.cs does not
        // depend on Redis or on database row contents, so the classified route set is identical
        // to the actual probe host's). Matches EndpointCatalogTests.CreateForEnvironment's own
        // pattern of booting extra hosts to inspect the real, unmodified route table.
        => NexoraApiFactory.CreateForEnvironment("Testing");

    [Theory]
    [MemberData(nameof(IdentityProbeCases), DisableDiscoveryEnumeration = true)]
    public async Task Route_enforces_its_classified_authorization_gate(ClassifiedRoute route, string scenarioId)
    {
        _ = scenarioId; // traceability id, asserted implicitly by which xunit test case ran

        switch (route.Class)
        {
            case IdentityClass.Public:
                await AssertPublicAsync(route);
                break;
            case IdentityClass.PolicyOnly:
                await AssertPolicyOnlyAsync(route);
                break;
            case IdentityClass.PermissionGated:
                await AssertPermissionGatedAsync(route);
                break;
            case IdentityClass.DeviceApiKey:
                await AssertDeviceOrApiKeyAsync(route);
                break;
            default:
                throw new InvalidOperationException($"Unreachable: {route.Class}");
        }
    }

    // ---- Probe implementations -------------------------------------------------------------

    private sealed record Envelope(bool Success, int StatusCode, string? Message, string? ErrorCode);

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, ClassifiedRoute route)
    {
        var path = ConcretizeRoute(route.Route);
        var httpMethod = new HttpMethod(route.Method == "ANY" ? "GET" : route.Method);
        HttpContent? body = null;
        if (httpMethod == HttpMethod.Post || httpMethod == HttpMethod.Put || httpMethod == HttpMethod.Patch)
        {
            // Send whichever content-type (if any) the real endpoint actually declares (Ruling A:
            // "use the cheapest real HTTP shape that reaches the authz gate") — routing's own
            // content negotiation runs BEFORE authorization, so a JSON body against a
            // multipart/form-data (IFormFile) endpoint 415s pre-auth and never actually exercises
            // the authz gate at all. An empty multipart body is the cheapest real shape for those;
            // "{}" is the cheapest real shape for JSON-DTO endpoints.
            var acceptsMultipart = route.AcceptedContentType?.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase) == true;
            body = acceptsMultipart
                ? new MultipartFormDataContent()
                : new StringContent("{}", Encoding.UTF8, "application/json");
        }
        var request = new HttpRequestMessage(httpMethod, path) { Content = body };
        return await client.SendAsync(request);
    }

    // Replaces route parameter placeholders with a syntactically-valid but non-existent value so
    // the request reaches the authz gate (route constraints like :guid must still bind) without
    // needing real seeded data for every one of 1,678 routes (Ruling A: proving the gate fires,
    // not full business success).
    private static string ConcretizeRoute(string route)
    {
        var result = route;
        result = System.Text.RegularExpressions.Regex.Replace(result, @"\{[^}]*:guid\}", Guid.NewGuid().ToString());
        result = System.Text.RegularExpressions.Regex.Replace(result, @"\{\*\*[^}]*\}", "nonexistent");
        result = System.Text.RegularExpressions.Regex.Replace(result, @"\{[^}]*\}", "nonexistent");
        return result;
    }

    private static async Task<Envelope?> TryReadEnvelopeAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            return JsonSerializer.Deserialize<Envelope>(body, JsonOpts);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // Classification 1: Public (AllowAnonymous, no RequirePermission) — anonymous real HTTP call
    // must NOT return 401.
    private async Task AssertPublicAsync(ClassifiedRoute route)
    {
        var client = _redisHost.CreateClient();
        var response = await SendAsync(client, route);
        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized,
            $"{route.Method} {route.Route} is classified Public (AllowAnonymous/no auth metadata) — an anonymous " +
            $"call must not be rejected as unauthenticated. Got {(int)response.StatusCode}.");
    }

    // Classification 2: Policy-only — anonymous -> 401; wrong user_type -> 401/403 (assert
    // whichever the real pipeline returns); correct user_type -> NOT an authz failure specifically
    // (may still be 4xx/5xx for unrelated reasons — distinguished by errorCode, not raw status).
    private async Task AssertPolicyOnlyAsync(ClassifiedRoute route)
    {
        var anon = await SendAsync(_redisHost.CreateClient(), route);
        anon.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            $"{route.Method} {route.Route} is Policy-only ({route.PolicyName ?? "(default)"}) — anonymous must be 401.");

        var (correctType, wrongType) = ResolveUserTypesFor(route.PolicyName);

        // A bare RequireAuthorization() (no named policy) only asserts RequireAuthenticatedUser()
        // — Program.cs's real policy table shows it carries NO user_type claim assertion, so there
        // is no real "wrong user_type" rejection to observe for it (any authenticated principal
        // satisfies the policy). Only the named policies (AdminOrAbove/Citizen/Company/...) declare
        // a user_type discriminator worth probing.
        if (wrongType is not null)
        {
            var wrongClient = _redisHost.CreateClient();
            wrongClient.DefaultRequestHeaders.Authorization = new("Bearer", MintPolicyProbeToken(wrongType));
            var wrongResp = await SendAsync(wrongClient, route);
            wrongResp.StatusCode.Should().BeOneOf([HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden],
                $"{route.Method} {route.Route}: a wrong-user_type ('{wrongType}') authenticated identity must be " +
                $"rejected as an authorization failure (401 or 403). Got {(int)wrongResp.StatusCode}.");
        }

        var correctClient = _redisHost.CreateClient();
        correctClient.DefaultRequestHeaders.Authorization = new("Bearer", MintPolicyProbeToken(correctType));
        var correctResp = await SendAsync(correctClient, route);
        var envelope = await TryReadEnvelopeAsync(correctResp);
        var isAuthChallenge = correctResp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
            && (envelope is null || envelope.ErrorCode is "UNAUTHORIZED" or "FORBIDDEN" or "SESSION_INVALIDATED");
        isAuthChallenge.Should().BeFalse(
            $"{route.Method} {route.Route}: a correct-user_type ('{correctType}') identity must not fail for " +
            $"authorization reasons. Got {(int)correctResp.StatusCode} errorCode={envelope?.ErrorCode ?? "(none)"}.");
    }

    // Classification 3: Permission-gated — anonymous -> 401; authenticated admin with a role
    // holding NO permissions -> 403 FORBIDDEN; a real admin whose role holds exactly that
    // permission key -> not rejected for authorization reasons.
    private async Task AssertPermissionGatedAsync(ClassifiedRoute route)
    {
        var anon = await SendAsync(_redisHost.CreateClient(), route);
        anon.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            $"{route.Method} {route.Route} is Permission-gated — anonymous must be 401.");

        var permissionlessClient = await _redisHost.CreateClientAsync(
            TestIdentity.PermissionlessAdmin(Guid.NewGuid(), $"perm-neg-{Guid.NewGuid():N}@nexora.local"));
        var permissionlessResp = await SendAsync(permissionlessClient, route);
        var permissionlessEnvelope = await TryReadEnvelopeAsync(permissionlessResp);
        permissionlessResp.StatusCode.Should().Be(HttpStatusCode.Forbidden,
            $"{route.Method} {route.Route}: authenticated admin with a permission-less role must get 403.");
        permissionlessEnvelope?.ErrorCode.Should().Be("FORBIDDEN");

        var key = route.PermissionKeys![0];
        var grantedClient = await _redisHost.CreateClientWithPermissionAsync(
            Guid.NewGuid(), $"perm-pos-{Guid.NewGuid():N}@nexora.local", key);
        var grantedResp = await SendAsync(grantedClient, route);
        var grantedEnvelope = await TryReadEnvelopeAsync(grantedResp);
        var isAuthFailure = grantedResp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
            && (grantedEnvelope is null || grantedEnvelope.ErrorCode is "UNAUTHORIZED" or "FORBIDDEN" or "SESSION_INVALIDATED");
        isAuthFailure.Should().BeFalse(
            $"{route.Method} {route.Route}: an admin whose role holds the exact required permission key " +
            $"'{key}' must not be rejected for authorization reasons. Got {(int)grantedResp.StatusCode} " +
            $"errorCode={grantedEnvelope?.ErrorCode ?? "(none)"}.");
    }

    // Classification 4: Device/API-key — a request with a missing/invalid key must be rejected
    // (401/403/400 per that group's own real handler behavior); a valid key must not be rejected
    // for that reason. Observed live per group (see task-6-report.md RED/probe evidence):
    //   - X-Api-Key groups (AiCatalog/Public via PublicApiKeyFilter): missing key -> raw 401
    //     (RFC9110 ProblemDetails shape, not the ApiResponse envelope); valid key -> not 401.
    //   - X-Device-Key manual-check groups: missing/invalid key does not itself 401/403 the HTTP
    //     call (these are AllowAnonymous by design, e.g. a physical device with no user identity)
    //     — the real handler instead returns a 200 envelope carrying a DOMAIN-level deny in the
    //     body (e.g. DeviceCheckInResultDto.Allowed=false, "Cihaz yetkisi geçersiz"/"Cihaz kimlik
    //     bilgisi eksik"), or an LiderTek/webhook protocol Deny() payload for the two webaccess
    //     hardware-webhook routes. The assertion below reflects that REAL behavior rather than
    //     assuming a single status code (brief: "do not assume a single status code, observe and
    //     assert what's real").
    private async Task AssertDeviceOrApiKeyAsync(ClassifiedRoute route)
    {
        var isApiKeyGroup = route.Route.StartsWith("/api/v1/public/", StringComparison.Ordinal);
        var client = _redisHost.CreateClient();

        if (isApiKeyGroup)
        {
            var missing = await SendAsync(client, route);
            missing.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
                $"{route.Method} {route.Route}: PublicApiKeyFilter must reject a missing X-Api-Key with 401.");

            var withKey = _redisHost.CreateClient();
            withKey.DefaultRequestHeaders.Add("X-Api-Key", NexoraApiFactory.PublicApiTestKey);
            var valid = await SendAsync(withKey, route);
            valid.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized,
                $"{route.Method} {route.Route}: a valid X-Api-Key must not be rejected as unauthorized.");
        }
        else
        {
            // Manual X-Device-Key groups are AllowAnonymous — the gate is enforced inside the
            // handler body as a domain-level deny, not an HTTP 401/403. Prove the REAL shape:
            // a call with no key/body reaches the handler (not blocked pre-flight) and returns
            // 200 with a real rejection message in the payload, distinguishing it from a route
            // that is simply broken (500) or silently permissive (an actual success/approval).
            var response = await SendAsync(client, route);
            response.StatusCode.Should().Be(HttpStatusCode.OK,
                $"{route.Method} {route.Route}: manual device-key routes are AllowAnonymous by design; " +
                $"the real gate is a domain-level deny inside a 200 envelope, not an HTTP-level rejection. " +
                $"Got {(int)response.StatusCode}.");

            var body = await response.Content.ReadAsStringAsync();
            body.Should().NotBeNullOrWhiteSpace();
            var deniedForMissingKey =
                body.Contains("Cihaz yetkisi geçersiz", StringComparison.Ordinal) ||
                body.Contains("Cihaz kimlik bilgisi eksik", StringComparison.Ordinal) ||
                body.Contains("Cihaz tanımlı değil", StringComparison.Ordinal) ||
                body.Contains("\"Clear_Screen\":\"C8412F\"", StringComparison.Ordinal) || // LiderTek/Library webhook Deny() screen color
                body.Contains("\"Session_Id\"", StringComparison.Ordinal); // Ack() with no key: handled but not approved
            deniedForMissingKey.Should().BeTrue(
                $"{route.Method} {route.Route}: a request with no device key must not be silently treated as an " +
                $"approved/authorized device. Real body: {body}");
        }
    }

    // user_type claim values for each named policy, matching Program.cs's real policy
    // definitions (AdminOrAbove/StaffOrAbove -> "admin", Citizen -> "citizen", Company ->
    // "company", CompanyStaff -> "company_staff", CompanyOrStaff -> "company" or "company_staff",
    // unnamed bare RequireAuthorization() -> any authenticated principal, wrong-type probe reuses
    // "citizen" as a real different type since every one of these policies excludes it).
    private static (string Correct, string? Wrong) ResolveUserTypesFor(string? policyName) => policyName switch
    {
        "AdminOrAbove" or "StaffOrAbove" => ("admin", "citizen"),
        "Citizen" => ("citizen", "company"),
        "Company" => ("company", "citizen"),
        "CompanyStaff" => ("company_staff", "citizen"),
        "CompanyOrStaff" => ("company", "citizen"),
        // Bare RequireAuthorization() (no policy name): Program.cs's real policy table shows this
        // is RequireAuthenticatedUser() only, with NO user_type claim assertion — any authenticated
        // principal satisfies it, so there is no real "wrong user_type" case to probe.
        null => ("admin", null),
        _ => throw new InvalidOperationException($"Unknown policy '{policyName}' — Program.cs added a policy not covered here."),
    };

    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    private static string MintPolicyProbeToken(string userType)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new(System.Security.Claims.ClaimTypes.Name, "Policy Probe"),
            new("user_type", userType),
            new("must_change_password", "false"),
        };
        if (userType == "admin")
        {
            claims.Add(new("is_super_admin", "false"));
            claims.Add(new("adminSessionId", Guid.NewGuid().ToString()));
        }
        else
        {
            claims.Add(new("sessionId", Guid.NewGuid().ToString()));
        }

        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new Microsoft.IdentityModel.Tokens.SigningCredentials(key, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            JwtIssuer, JwtAudience, claims, now, now.AddMinutes(10), creds);
        return new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);
    }

    // ---- Step 3 (Ruling B): session/account gating, proven ONCE against a representative sample,
    // not per-route. Both cases use the shared Redis-enabled host and freshly generated GUIDs so
    // there is zero risk of colliding with any other real usage of the shared dev Redis instance.

    [Fact]
    public async Task Invalidated_session_rejects_a_representative_AdminOrAbove_endpoint()
    {
        var userId = Guid.NewGuid();
        var client = await _redisHost.CreateClientAsync(TestIdentity.SuperAdmin(userId, $"session-inv-{Guid.NewGuid():N}@nexora.local"));

        var redis = _redisHost.Services.GetRequiredService<IRedisService>();
        // Write a DIFFERENT session id than the token's adminSessionId claim -> OnTokenValidated
        // (Program.cs) must fail authentication with SESSION_INVALIDATED before any endpoint runs.
        await redis.SetAsync($"auth:current-session-id:{userId}", Guid.NewGuid().ToString(), TimeSpan.FromMinutes(5));

        var response = await client.GetAsync("/api/v1/event-categories");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var envelope = await TryReadEnvelopeAsync(response);
        envelope!.ErrorCode.Should().Be("SESSION_INVALIDATED");
    }

    [Fact]
    public async Task Invalidated_session_rejects_a_representative_permission_gated_endpoint()
    {
        var userId = Guid.NewGuid();
        var email = $"session-inv-perm-{Guid.NewGuid():N}@nexora.local";
        var client = await _redisHost.CreateClientWithPermissionAsync(userId, email, "event-categories.view");

        var redis = _redisHost.Services.GetRequiredService<IRedisService>();
        await redis.SetAsync($"auth:current-session-id:{userId}", Guid.NewGuid().ToString(), TimeSpan.FromMinutes(5));

        var response = await client.GetAsync("/api/v1/event-categories");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var envelope = await TryReadEnvelopeAsync(response);
        envelope!.ErrorCode.Should().Be("SESSION_INVALIDATED");
    }

    // Ruling B, IsActive finding: AdminUser.IsActive/Deactivate() exist in the domain, and
    // ARE checked at LOGIN/REFRESH time (AuthService.LoginAsync/RefreshAsync throw
    // ACCOUNT_INACTIVE) — but grep across the JWT pipeline (Program.cs OnTokenValidated) and
    // PermissionEnforcementMiddleware confirms NEITHER path re-checks IsActive on a per-request
    // basis. A deactivated admin's ALREADY-ISSUED access token continues to authenticate and pass
    // permission checks until it naturally expires (JwtSettings:AccessTokenMinutes, default 60).
    // This test proves that real gap honestly (see task-6-report.md for the dated finding) instead
    // of fabricating enforcement that doesn't exist.
    [Fact]
    public async Task Deactivated_admin_account_finding_existing_token_still_authorizes_until_expiry()
    {
        var userId = Guid.NewGuid();
        var email = $"deactivated-{Guid.NewGuid():N}@nexora.local";
        var client = await _redisHost.CreateClientWithPermissionAsync(userId, email, "event-categories.view");

        await using (var scope = _redisHost.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Nexora.Infrastructure.Persistence.AppDbContext>();
            var admin = await db.AdminUsers.IgnoreQueryFilters().FirstAsync(u => u.Id == userId);
            admin.Deactivate();
            await db.SaveChangesAsync();
        }

        var response = await client.GetAsync("/api/v1/event-categories");

        // REAL, OBSERVED gap: this is NOT rejected. If a future fix wires IsActive into the JWT
        // pipeline or PermissionEnforcementMiddleware, this assertion should be changed to expect
        // 401/403 — until then, asserting the honest current behavior is the point of this test.
        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized,
            "documented finding (task-6-report.md): AdminUser.IsActive is only checked at login/refresh time, " +
            "not per-request; a deactivated admin's already-issued token keeps working until expiry.");
    }
}
