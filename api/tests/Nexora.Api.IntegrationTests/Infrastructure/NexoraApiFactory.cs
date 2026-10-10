using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Nexora.Api.Endpoints.TestSupport;
using Nexora.Domain.Entities.Auth;
using Nexora.Infrastructure.Persistence;
using Npgsql;
using Xunit;

namespace Nexora.Api.IntegrationTests.Infrastructure;

// Program.cs sets Npgsql's legacy timestamp behavior at startup, but the test fixtures open
// Npgsql connections before the hosted Program runs. The switch must be applied before the
// first Npgsql use in the process, so it is set here via a module initializer.
internal static class NpgsqlLegacySwitch
{
    [System.Runtime.CompilerServices.ModuleInitializer]
    public static void Enable() =>
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
}


// Boots the REAL hosted Nexora API (top-level Program in Nexora.Api) with Mvc.Testing against
// a real PostgreSQL database, in the Testing environment so the Task 3 residue support endpoint
// is mapped. Production integrations (Vault, Consul, Hangfire, Redis, MinIO, Elasticsearch) are
// disabled through Testing configuration. Migrations are applied once by Program's own startup
// path. No in-memory provider or mock is substituted for the data path.
//
// TEntryPoint is the public ResidueResponse type only to locate the Nexora.Api assembly entry
// point (top-level Program). The generic argument does not change which app is hosted.
public sealed class NexoraApiFactory : WebApplicationFactory<ResidueResponse>, IAsyncLifetime
{
    // 64 lowercase hex chars, no short repeating period -> satisfies TestSupportEndpoints.HasValidApiKey.
    public const string TestSupportApiKey =
        "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420";

    // Task 6: real key configured under PublicApi:ApiKeys for the PublicApiKeyFilter-protected
    // AiCatalog/Public route groups (X-Api-Key header).
    public const string PublicApiTestKey = "integration-test-public-api-key-2026";

    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    private readonly string _connectionString;
    private readonly string _environment;
    private readonly string _redisConnectionString;

    private NexoraApiFactory(string connectionString, string environment, string redisConnectionString = "")
    {
        _connectionString = connectionString;
        _environment = environment;
        _redisConnectionString = redisConnectionString;

        // Program.cs reads JwtSettings:SecretKey and ConnectionStrings:PostgreSQL during
        // top-level builder configuration, BEFORE builder.Build(). ConfigureAppConfiguration
        // callbacks only apply at Build time, so those early reads need process environment
        // variables (a default configuration source that is visible immediately). Values are
        // constant across factories except Redis (Task 6 added a Redis-enabled variant), so
        // ApplyEarlyConfiguration takes the Redis connection string explicitly per factory
        // instance rather than assuming a single process-global constant.
        ApplyEarlyConfiguration(_connectionString, _redisConnectionString);
    }

    private static void ApplyEarlyConfiguration(string connectionString, string redisConnectionString)
    {
        void Set(string key, string value) => Environment.SetEnvironmentVariable(key, value);

        Set("ConnectionStrings__PostgreSQL", connectionString);
        Set("ConnectionStrings__Redis", redisConnectionString);

        Set("JwtSettings__SecretKey", JwtSecret);
        Set("JwtSettings__Issuer", JwtIssuer);
        Set("JwtSettings__Audience", JwtAudience);

        Set("TestSupport__ApiKey", TestSupportApiKey);

        // Disable every production/shared integration through Testing configuration.
        Set("Vault__Enabled", "false");
        Set("Consul__EnableServiceDiscovery", "false");
        Set("Hangfire__Enabled", "false");
        Set("ElkSettings__Uri", "");
        Set("MinioSettings__Endpoint", "");
        Set("Push__Enabled", "false");

        // Non-Development leak-guard (Program.cs) forbids mock modes; keep real modes.
        Set("SmsSettings__UseMockMode", "false");
        Set("SmtpSettings__UseMockMode", "false");
        Set("Nvi__UseMockMode", "false");
        Set("OtpSettings__MockCode", "");
        Set("LibraryLock__AllowHttpOnPrivateNetwork", "false");
        Set("LibraryLock__UseHttps", "true");
        Set("Seed__Demo__Enabled", "false");

        // Seeded SuperAdmin used by the acceptance flow (matches DatabaseSeeder wiring).
        Set("Seed__SuperAdmin__FullName", "Test Süper Admin");
        Set("Seed__SuperAdmin__Email", "it-superadmin@nexora.local");
        Set("Seed__SuperAdmin__Password", "IntegrationTest2026!");

        Set("CorsSettings__AllowedOrigins__0", "http://localhost");

        Set("RateLimiting__GlobalPermitLimit", "100000");
        Set("RateLimiting__AuthPermitLimit", "100000");
        Set("RateLimiting__DevicePermitLimit", "100000");
    }

    // Testing-host factory bound to the collection's real PostgreSQL database.
    // NEXORA_IT_REDIS verilmişse koleksiyon host'u da Redis'li kurulur. Redis olmadan
    // OtpService gibi Redis'e ZORUNLU bağımlı servisleri kullanan uçlar (ör. tesis
    // başvuru akışı) DI hatasıyla 500 döner ve testler asıl davranışı hiç ölçemez
    // (2026-09-23 gerçek entegrasyon koşusunda tespit edildi).
    public static NexoraApiFactory CreateForCollection(PostgresFixture postgres) =>
        new(postgres.ConnectionString, "Testing",
            Environment.GetEnvironmentVariable("NEXORA_IT_REDIS") ?? "");

    // A host built under an arbitrary environment name (e.g. "Production") to prove the
    // Testing-only support endpoint is NOT mapped outside Testing. It reuses the same real
    // database (already migrated/seeded); route enumeration is read-only.
    public static NexoraApiFactory CreateForEnvironment(string environment)
    {
        var connectionString = Environment.GetEnvironmentVariable("NEXORA_IT_POSTGRES")
            ?? throw new InvalidOperationException(
                "NEXORA_IT_POSTGRES must be set (the collection's real database) before creating a non-Testing host.");
        return new NexoraApiFactory(connectionString, environment);
    }

    // Task 6 (Ruling B / device-key routes): a THIRD Testing host variant that enables the REAL
    // running Redis (container nexora-redis, port 34200) instead of disabling it. Two real needs
    // require this:
    //   1. Ruling B's session-invalidation/inactive-account probes need a real
    //      auth:current-session-id:{userId} key to write to and read back.
    //   2. Discovered live while building the authorization matrix (not anticipated by the brief):
    //      several real services behind PERMISSION and DEVICE_KEY-classified routes (e.g.
    //      LiderTekWebhookService, CitizenIdentityQrService, FacilityDeviceService,
    //      LibraryDeviceService, DeviceMonitorService) take a constructor dependency on
    //      IRedisService, which Infrastructure's DI only registers when ConnectionStrings:Redis
    //      is non-empty. Task 5's Redis-disabled host makes any request that reaches one of those
    //      handlers throw a DI InvalidOperationException (500) before the handler body runs —
    //      harmless for "not 401/403" positive-permission assertions (Ruling A already tolerates
    //      any non-auth failure there), but it makes the DEVICE_KEY classification's own
    //      valid-vs-invalid-key assertions meaningless (every response is the same masked 500
    //      regardless of key correctness). Running the ENTIRE authorization matrix against this
    //      Redis-enabled host avoids that ambiguity uniformly, not just for the two Ruling B cases.
    // Reuses the collection's already-migrated/seeded real Postgres database (read/write, same
    // pattern as CreateForEnvironment) — only the Redis connection differs.
    public static NexoraApiFactory CreateForCollectionWithRedis()
    {
        var connectionString = Environment.GetEnvironmentVariable("NEXORA_IT_POSTGRES")
            ?? throw new InvalidOperationException(
                "NEXORA_IT_POSTGRES must be set (the collection's real database) before creating the Redis-enabled host.");
        return new NexoraApiFactory(connectionString, "Testing", RedisConnectionString);
    }

    // Redis bağlantısı env ile override edilebilir (NEXORA_IT_REDIS). Varsayılan, repo'nun
    // docker-compose'undaki nexora-redis servisidir; Docker'sız bir geliştirici makinesinde
    // (ör. Homebrew redis, localhost:6379) testleri çalıştırabilmek için dışarıdan verilir.
    private static string RedisConnectionString =>
        Environment.GetEnvironmentVariable("NEXORA_IT_REDIS")
        ?? "localhost:34200,password=NexoraRedis2026!";


    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(_environment);

        // RouteHandlerOptions.ThrowOnBadRequest is now forced on for every environment in the
        // product's own Program.cs, so no test-only override is needed here: the unmodified
        // production host already throws JsonException/BadHttpRequestException into
        // ExceptionHandlingMiddleware for malformed bodies and invalid route/query values.

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PostgreSQL"] = _connectionString,
                ["ConnectionStrings:Redis"] = _redisConnectionString,

                ["JwtSettings:SecretKey"] = JwtSecret,
                ["JwtSettings:Issuer"] = JwtIssuer,
                ["JwtSettings:Audience"] = JwtAudience,

                ["TestSupport:ApiKey"] = TestSupportApiKey,

                // Task 6 (Ruling A, "API-key" classification: AiCatalog/Public groups behind
                // PublicApiKeyFilter). A real, non-empty key must be configured so the
                // valid-key case can be proven not-rejected; empty ApiKeys (Task 5 default) made
                // every request 401 regardless of the key presented.
                ["PublicApi:Enabled"] = "true",
                ["PublicApi:RequireApiKey"] = "true",
                ["PublicApi:ApiKeys:0"] = PublicApiTestKey,

                // Disable every production/shared integration through Testing configuration.
                ["Vault:Enabled"] = "false",
                ["Consul:EnableServiceDiscovery"] = "false",
                ["Hangfire:Enabled"] = "false",
                ["ElkSettings:Uri"] = "",
                ["MinioSettings:Endpoint"] = "",
                ["Push:Enabled"] = "false",

                // Non-Development leak-guard (Program.cs) forbids mock modes; keep real modes.
                ["SmsSettings:UseMockMode"] = "false",
                ["SmtpSettings:UseMockMode"] = "false",
                ["Nvi:UseMockMode"] = "false",
                ["OtpSettings:MockCode"] = "",
                ["LibraryLock:AllowHttpOnPrivateNetwork"] = "false",
                ["LibraryLock:UseHttps"] = "true",
                ["Seed:Demo:Enabled"] = "false",

                // Seeded SuperAdmin used by the acceptance flow (matches DatabaseSeeder wiring).
                ["Seed:SuperAdmin:FullName"] = "Test Süper Admin",
                ["Seed:SuperAdmin:Email"] = "it-superadmin@nexora.local",
                ["Seed:SuperAdmin:Password"] = "IntegrationTest2026!",

                ["CorsSettings:AllowedOrigins:0"] = "http://localhost",

                ["RateLimiting:GlobalPermitLimit"] = "100000",
                ["RateLimiting:AuthPermitLimit"] = "100000",
                ["RateLimiting:DevicePermitLimit"] = "100000",

                // Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu):
                // Microsoft.AspNetCore.TestHost's in-memory transport never populates
                // HttpContext.Connection.RemoteIpAddress (it stays null — there is no real
                // socket). CurrentUser.ResolveIpAddress's ShouldTrustForwardedHeaders short-
                // circuits to false whenever the connecting IP is null, so every test request's
                // resolved IpAddress was unconditionally null regardless of any X-Forwarded-For
                // header a test sent — LibraryDeviceMatrixTests' whole IP-shift-takeover suite
                // (GetActiveByIpAsync keys off current.IpAddress) could never actually observe a
                // takeover; ShiftTakeover_DifferentStaffSameIp_RealIpTakeover_MarksEndedByIpTakeover
                // failed on real HTTP/DB assertions once the secver/geofence bugs stopped masking
                // it earlier. SyntheticRemoteIpMiddleware below (Testing-only) fills the same gap
                // a real reverse proxy fills in production: a stable, real connecting IP for
                // TrustedProxies to authorize, so X-Forwarded-For behaves exactly as it does behind
                // nexora-lb in docker-compose (matching appsettings.Production.json's own
                // 172.27.0.0/16 pattern, just with the loopback TestServer actually uses).
                ["Security:TrustedProxies:0"] = "127.0.0.1",
            });
        });

        // F17 (denetim 2026-09-16): MinioSettings:Endpoint boş bırakıldığı için (üstteki
        // yorum) Nexora.Infrastructure.DependencyInjection IFileStorageService'i hiç
        // kaydetmiyordu. Bu servisi enjekte eden herhangi bir handler DI çözümlemesinde
        // patlıyordu (matris logundaki 105 INTERNAL_SERVER_ERROR'ın kök nedeni). Gerçek
        // Minio'ya bağlanmayan ama gerçekten çalışan bir bellek-içi double kaydedilir.
        builder.ConfigureTestServices(services =>
        {
            // Audit runs exercise registrations/attendance without sending messages externally.
            if (Environment.GetEnvironmentVariable("NEXORA_IT_SUPPRESS_DELIVERY") == "true")
                services.AddSingleton(Moq.Mock.Of<Nexora.Application.Common.Interfaces.INotificationDispatcher>());
            services.AddSingleton<Nexora.Application.Common.Interfaces.IFileStorageService, InMemoryFileStorageService>();
            services.AddTransient<Microsoft.AspNetCore.Hosting.IStartupFilter, SyntheticRemoteIpStartupFilter>();
        });
    }

    public async Task InitializeAsync()
    {
        // Force the host to build now so Program's migrate + seed startup runs against the
        // real database, and surface any startup failure immediately.
        _ = Services.GetRequiredService<IConfiguration>();
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Program already applied pending migrations at startup; assert the schema is real.
        var applied = await db.Database.GetAppliedMigrationsAsync();
        if (!applied.Any())
            throw new InvalidOperationException("Expected migrations to be applied to the real test database.");
    }

    public new async Task DisposeAsync() => await base.DisposeAsync();

    // Ensures an admin user with the identity's role exists in the real database so the
    // permission middleware resolves it, then returns a client bearing a signed JWT whose
    // claims match the production JwtService shape.
    public async Task<HttpClient> CreateClientAsync(TestIdentity identity)
    {
        int securityVersion;
        await using (var scope = Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            securityVersion = await EnsureAdminUserAsync(db, identity);
        }

        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(identity, securityVersion));
        return client;
    }

    // c1bd741 (SecurityVersion tabanlı oturum geçersizleştirme): OnTokenValidated (Program.cs)
    // Redis-enabled hostlarda token'daki "secver" claim'ini DB'deki GÜNCEL SecurityVersion ile
    // karşılaştırır. Bu yardımcı, o gerçek DB değerini (CompletePasswordChange gibi çağrılar
    // SecurityVersion'ı artırabildiğinden 0 varsayılamaz) döndürür ki CreateToken doğru "secver"
    // claim'ini üretsin — aksi halde her Redis-enabled host testinde sahte 401 alınır.
    private static async Task<int> EnsureAdminUserAsync(AppDbContext db, TestIdentity identity)
    {
        var existing = await db.AdminUsers.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == identity.UserId);
        if (existing is not null)
            return existing.SecurityVersion;

        // A role that intentionally holds no permissions (for the missing-permission case).
        var roleKey = identity.RoleName ?? "IntegrationTestRole";
        var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == roleKey);
        if (role is null)
        {
            role = Role.Create(roleKey, roleKey, "Integration test role");
            if (identity.IsSuperAdmin) role.SetIsSuperAdmin(true);
            await db.Roles.AddAsync(role);
            await db.SaveChangesAsync();
        }

        var admin = AdminUser.Create(identity.FullName, identity.Email, null, null, "x", role.Id);
        admin.Id = identity.UserId;
        admin.CompletePasswordChange("x"); // clear MustChangePassword so middleware does not block.
        await db.AdminUsers.AddAsync(admin);
        await db.SaveChangesAsync();
        return admin.SecurityVersion;
    }

    // Task 6 (Ruling A, classification 3 "Permission-gated"): creates a real admin bound to a real
    // role that holds EXACTLY the one requested permission key (via the real
    // Permissions/RolePermissions tables the seeded catalog already populated), then returns a
    // client bearing a signed JWT for that identity. Proves PermissionEnforcementMiddleware's
    // POSITIVE path (has the permission -> not rejected for authorization reasons), the
    // counterpart to TestIdentity.PermissionlessAdmin's negative path.
    public async Task<HttpClient> CreateClientWithPermissionAsync(Guid userId, string email, string permissionKey)
    {
        int securityVersion;
        await using (var scope = Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var permission = await db.Permissions.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Key == permissionKey)
                ?? throw new InvalidOperationException(
                    $"Permission key '{permissionKey}' not found in the seeded catalog (DatabaseSeeder.Catalog) — " +
                    "the real EndpointDataSource declared a RequirePermission key that does not exist in the real permission catalog.");

            var roleKey = $"it-perm-{permissionKey}";
            var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == roleKey);
            if (role is null)
            {
                role = Role.Create(roleKey, roleKey, $"Integration test role holding exactly '{permissionKey}'");
                await db.Roles.AddAsync(role);
                await db.SaveChangesAsync();

                await db.RolePermissions.AddAsync(RolePermission.Create(role.Id, permission.Id));
                await db.SaveChangesAsync();
            }

            var admin = AdminUser.Create($"IT Perm {permissionKey}", email, null, null, "x", role.Id);
            admin.Id = userId;
            admin.CompletePasswordChange("x");
            await db.AdminUsers.AddAsync(admin);
            await db.SaveChangesAsync();
            securityVersion = admin.SecurityVersion;
        }

        var identity = new TestIdentity(userId, $"IT Perm {permissionKey}", email, IsSuperAdmin: false, RoleName: $"it-perm-{permissionKey}");
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(identity, securityVersion));
        return client;
    }

    // Task 8 (Ruling D): the C# integration project has no citizen-facing identity helper prior to
    // this task (TestIdentity.cs only covers admin SuperAdmin/PermissionlessAdmin). Events/Travels'
    // citizen surfaces (MeEventEndpoints/MeTravelEndpoints, RequireAuthorization("Citizen")) need a
    // real Participant row + a token whose claim shape is provably identical to what
    // JwtService.GenerateCitizenAccessToken produces in production, so the real Citizen policy and
    // downstream ParticipantEventService/ParticipantTravelService code execute unchanged (not a
    // repurposed admin token, per the brief's explicit instruction). Seeds the Participant directly
    // via EF (cheaper and equally real than driving the full HTTP OTP flow, matching TestIdentity's
    // own admin-seeding trade-off) then mints a token using the exact same claim set/signing key the
    // hosted JwtService uses.
    public async Task<HttpClient> CreateCitizenClientAsync(CitizenTestIdentity identity)
    {
        int securityVersion = 0;
        await using (var scope = Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.Participants.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == identity.ParticipantId);
            if (existing is null)
            {
                var participant = Nexora.Domain.Entities.Participants.Participant.Create(
                    identity.Tckn,
                    identity.FullName,
                    identity.BirthDate,
                    identity.Gender,
                    isMinor: false,
                    passwordHash: "x",
                    email: identity.Email,
                    phone: identity.Phone,
                    guardianPhone: null,
                    guardianEmail: null,
                    address: identity.Address);
                participant.Id = identity.ParticipantId;
                // Clear MustChangePassword so MustChangePasswordMiddleware does not block apply/reserve
                // calls made through this client, matching TestIdentity.EnsureAdminUserAsync's own
                // CompletePasswordChange call for admins.
                participant.CompleteInitialPassword("x");
                await db.Participants.AddAsync(participant);
                await db.SaveChangesAsync();
                securityVersion = participant.SecurityVersion;
            }
            else
            {
                securityVersion = existing.SecurityVersion;
            }
        }

        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateCitizenToken(identity, securityVersion));
        return client;
    }

    // Links a real ParticipantGuardian row (guardianId -> childId) so ApplyAsync/ReserveAsync's
    // real uow.Participants.GetChildrenAsync(actorId, ...) call recognizes the relationship, per
    // Ruling E: family/child coverage must use the real parent-child link mechanism, not a shortcut.
    public async Task LinkChildAsync(Guid guardianId, Guid childId)
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var exists = await db.Set<Nexora.Domain.Entities.Participants.ParticipantGuardian>().IgnoreQueryFilters()
            .AnyAsync(g => g.GuardianId == guardianId && g.ChildId == childId);
        if (exists) return;

        await db.Set<Nexora.Domain.Entities.Participants.ParticipantGuardian>().AddAsync(
            Nexora.Domain.Entities.Participants.ParticipantGuardian.Create(guardianId, childId, "child"));
        await db.SaveChangesAsync();
    }

    private static string CreateCitizenToken(CitizenTestIdentity identity, int securityVersion = 0)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identity.ParticipantId.ToString()),
            new Claim(ClaimTypes.Name, identity.FullName),
            new Claim("user_type", "citizen"),
            new Claim("sessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
            // c1bd741 (SecurityVersion tabanlı oturum geçersizleştirme): OnTokenValidated artık
            // Redis-enabled hostlarda token'daki "secver" claim'ini DB'deki güncel SecurityVersion
            // ile karşılaştırıyor. CompleteInitialPassword gibi çağrılar SecurityVersion'ı 0'dan
            // farklı yapabildiğinden, çağıran gerçek DB değerini geçirmeli (varsayılan 0 yalnız
            // henüz hiç yazılmamış taze bir kayıt için doğrudur).
            new Claim("secver", securityVersion.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string CreateToken(TestIdentity identity, int securityVersion = 0)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identity.UserId.ToString()),
            new Claim(ClaimTypes.Name, identity.FullName),
            new Claim(ClaimTypes.Email, identity.Email),
            new Claim("user_type", "admin"),
            new Claim("is_super_admin", identity.IsSuperAdmin ? "true" : "false"),
            new Claim("role_name", identity.RoleName ?? ""),
            new Claim("adminSessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
            // c1bd741: bkz. CreateCitizenToken'daki aynı not — çağıran gerçek DB SecurityVersion
            // değerini geçirmeli (CompletePasswordChange gibi çağrılar 0'dan farklı yapabilir).
            new Claim("secver", securityVersion.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu): TestServer'ın
// bellek-içi transport'u gerçek bir soket açmadığından HttpContext.Connection.RemoteIpAddress
// hiçbir zaman doldurulmaz (null kalır). CurrentUser.ResolveIpAddress (ve Program.cs'teki
// GetClientIp) "remote is null" olduğunda X-Forwarded-For'a HİÇ bakmadan false döner (F03
// denetiminin güvenli varsayılanı, kasıtlı) — yani testlerde current.IpAddress her zaman null
// kalıyordu, bir test hangi sahte X-Forwarded-For'u gönderirse göndersin. Bu, IP eşleşmesine
// dayanan HER ŞEYİ (LibraryShiftService'in aynı-IP mesai devralma tespiti, ip-restriction,
// audit log IP alanı) testlerde gözlemlenemez kılıyordu — LibraryDeviceMatrixTests'in
// ShiftTakeover_DifferentStaffSameIp_RealIpTakeover_MarksEndedByIpTakeover testinde gerçek
// HTTP/DB assertion'larıyla yakalandı (secver/geofence bug'ları düzeltilip test daha derine
// inince ortaya çıktı). Bu middleware TestServer'ın bağlantı IP'sini sabit bir loopback'e
// ayarlayarak gerçek nginx-proxy topolojisini taklit eder (yukarıdaki
// Security:TrustedProxies:0=127.0.0.1 ile eşleşir) — GetClientIp/ResolveIpAddress'in kendisi
// HİÇ değiştirilmedi, yalnızca testin eksik olan "gerçek bir proxy arkasındayım" ön koşulu
// sağlandı; XFF hâlâ yalnızca bu güvenilir tek adres için onurlandırılır, üretimdeki güvenlik
// modeliyle birebir aynı.
internal sealed class SyntheticRemoteIpStartupFilter : Microsoft.AspNetCore.Hosting.IStartupFilter
{
    public Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> Configure(
        Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> next)
        => app =>
        {
            app.Use(async (ctx, nextMiddleware) =>
            {
                ctx.Connection.RemoteIpAddress ??= System.Net.IPAddress.Parse("127.0.0.1");
                await nextMiddleware();
            });
            next(app);
        };
}

// Owns the real PostgreSQL database and the hosted Testing API for the whole collection.
// Postgres is created once, the host boots once (applying migrations + seed once), and both
// are torn down after the collection completes.
public sealed class ApiTestHost : IAsyncLifetime
{
    public PostgresFixture Postgres { get; } = new();
    public NexoraApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Postgres.InitializeAsync();
        // Expose the collection database to non-Testing hosts spun up inside tests.
        Environment.SetEnvironmentVariable("NEXORA_IT_POSTGRES", Postgres.ConnectionString);

        // Materialize the current EF model schema against the real empty database and stamp the
        // full migration history, so the hosted app's startup migrate step sees zero pending
        // migrations and seeds against a model-accurate real PostgreSQL schema.
        await ProvisionSchemaAsync(Postgres.ConnectionString);

        Factory = NexoraApiFactory.CreateForCollection(Postgres);
        await Factory.InitializeAsync();
    }

    private static async Task ProvisionSchemaAsync(string connectionString)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        await using var db = new AppDbContext(options);

        await db.Database.EnsureCreatedAsync();

        // EnsureCreated builds the model's tables but not the code-number sequences that are
        // created by raw-SQL migrations (AddCodeSequences / AddMoreCodeSequences / seda). The
        // Event/Session/Travel create flows call nextval on these, so create them explicitly.
        string[] codeSequences =
        [
            "event_code_seq",
            "event_application_code_seq",
            "event_qr_code_seq",
            "session_code_seq",
            "travel_code_seq",
            "travel_application_code_seq",
            "seda_application_code_seq",
        ];

        var migrations = db.Database.GetMigrations().ToList();
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        foreach (var sequence in codeSequences)
        {
            await using var seq = connection.CreateCommand();
            seq.CommandText = $"CREATE SEQUENCE IF NOT EXISTS {sequence} START 1 INCREMENT 1 MINVALUE 1 NO CYCLE";
            await seq.ExecuteNonQueryAsync();
        }

        await using (var ensureHistory = connection.CreateCommand())
        {
            ensureHistory.CommandText =
                "CREATE TABLE IF NOT EXISTS \"__EFMigrationsHistory\" " +
                "(\"MigrationId\" varchar(150) NOT NULL CONSTRAINT \"PK___EFMigrationsHistory\" PRIMARY KEY, " +
                "\"ProductVersion\" varchar(32) NOT NULL)";
            await ensureHistory.ExecuteNonQueryAsync();
        }

        foreach (var migrationId in migrations)
        {
            await using var stamp = connection.CreateCommand();
            stamp.CommandText =
                "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") " +
                "VALUES (@id, '10.0.0') ON CONFLICT (\"MigrationId\") DO NOTHING";
            stamp.Parameters.AddWithValue("id", migrationId);
            await stamp.ExecuteNonQueryAsync();
        }

        Console.WriteLine(
            $"[ApiTestHost] Provisioned model schema via EnsureCreated and stamped {migrations.Count} migration(s).");
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null)
            await Factory.DisposeAsync();
        await Postgres.DisposeAsync();
    }
}

[CollectionDefinition(ApiCollection.Name)]
public sealed class ApiCollection : ICollectionFixture<ApiTestHost>
{
    public const string Name = "Nexora hosted API (real PostgreSQL)";
}
