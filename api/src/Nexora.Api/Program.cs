using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using Hangfire;
using MapsterMapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using Nexora.Api.Common;
using Nexora.Api.Common.Hangfire;
using Nexora.Api.Common.Middleware;
using Nexora.Api.Common.OpenApi;
using Nexora.Api.Common.RateLimiting;
using Nexora.Api.Endpoints;
using Nexora.Api.Endpoints.Admin;
using Nexora.Api.Endpoints.Analytics;
using Nexora.Api.Endpoints.AuditLogs;
using Nexora.Api.Endpoints.SmsAudit;
using Nexora.Api.Endpoints.SmsSend;
using Nexora.Api.Endpoints.SmsPermissions;
using Nexora.Api.Endpoints.Reports;
using Nexora.Api.Endpoints.Devices;
using Nexora.Api.Endpoints.Public;
using Nexora.Api.Endpoints.AiCatalog;
using Nexora.Api.Endpoints.Notifications;
using Nexora.Api.Endpoints.Dev;
using Nexora.Api.Endpoints.TestSupport;
using Nexora.Api.Endpoints.Files;
using Nexora.Api.Endpoints.Auth;
using Nexora.Api.Endpoints.Departments;
using Nexora.Api.Endpoints.CitizenSubmissions;
using Nexora.Api.Endpoints.CitizenMenu;
using Nexora.Api.Endpoints.MobileMenu;
using Nexora.Api.Endpoints.MobileConfig;
using Nexora.Api.Endpoints.SystemBranding;
using Nexora.Api.Endpoints.Loyalty;
using Nexora.Api.Endpoints.AppMenu;
using Nexora.Api.Endpoints.TopMenu;
using Nexora.Api.Endpoints.Companies;
using Nexora.Api.Endpoints.Bakkart;
using Nexora.Api.Endpoints.CompanyAuth;
using Nexora.Api.Endpoints.CompanyMe;
using Nexora.Api.Endpoints.CompanyStaffAuth;
using Nexora.Api.Endpoints.EmergencyAreas;
using Nexora.Api.Endpoints.Wheels;
using Nexora.Api.Endpoints.Popups;
using Nexora.Api.Endpoints.Events;
using Nexora.Api.Endpoints.Quizzes;
using Nexora.Api.Endpoints.Surveys;
using Nexora.Api.Endpoints.Halls;
using Nexora.Api.Endpoints.Travels;
using Nexora.Api.Endpoints.Libraries;
using Nexora.Api.Endpoints.DeviceMonitor;
using Nexora.Api.Endpoints.Me;
using Nexora.Api.Endpoints.Participants;
using Nexora.Api.Endpoints.ParticipantAuth;
using Nexora.Api.Endpoints.Permissions;
using Nexora.Api.Endpoints.Roles;
using Nexora.Api.Endpoints.Seda;
using Nexora.Api.Endpoints.ServiceFacilities;
using Nexora.Api.Endpoints.Education;
using Nexora.Api.Endpoints.QrSystem;
using Nexora.Api.Endpoints.Integrations;
using Nexora.Api.Endpoints.CorporateProxy;
using Nexora.Api.Endpoints.DutyPharmacies;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Mapping;
using Nexora.Infrastructure;
using Nexora.Infrastructure.Vault;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Sinks.Elasticsearch;
using Winton.Extensions.Configuration.Consul;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

{
    var minWorkerMultiplier = builder.Configuration.GetValue("ThreadPool:MinWorkerMultiplier", 12);
    var minWorkerFloor = builder.Configuration.GetValue("ThreadPool:MinWorkerFloor", 200);
    ThreadPool.GetMinThreads(out _, out var minIoThreads);
    ThreadPool.SetMinThreads(Math.Max(Environment.ProcessorCount * minWorkerMultiplier, minWorkerFloor), minIoThreads);
}

builder.WebHost.ConfigureKestrel(options =>
{
    var minBodyRateBytes = builder.Configuration.GetValue("Kestrel:MinRequestBodyDataRateBytesPerSecond", 100);
    var minBodyRateGraceSeconds = builder.Configuration.GetValue("Kestrel:MinRequestBodyDataRateGracePeriodSeconds", 30);
    options.Limits.MinRequestBodyDataRate = new Microsoft.AspNetCore.Server.Kestrel.Core.MinDataRate(
        bytesPerSecond: minBodyRateBytes, gracePeriod: TimeSpan.FromSeconds(minBodyRateGraceSeconds));
    var maxConcurrentConnections = builder.Configuration.GetValue("Kestrel:MaxConcurrentConnections", 4000);
    var maxConcurrentUpgraded = builder.Configuration.GetValue("Kestrel:MaxConcurrentUpgradedConnections", 4000);
    var maxRequestBodyBytes = builder.Configuration.GetValue<long?>("Kestrel:MaxRequestBodyBytes", 10 * 1024 * 1024);
    options.Limits.MaxConcurrentConnections = maxConcurrentConnections;
    options.Limits.MaxConcurrentUpgradedConnections = maxConcurrentUpgraded;
    options.Limits.MaxRequestBodySize = maxRequestBodyBytes;
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.Converters.Add(new TurkeyDateTimeConverter());
    options.SerializerOptions.Converters.Add(new TurkeyNullableDateTimeConverter());
    options.SerializerOptions.Converters.Add(new NullableGuidConverter());
});

var loggerFactory = LoggerFactory.Create(lb => lb.AddConsole());
builder.Configuration.AddVaultSecrets(builder.Configuration, loggerFactory);

var consulEnabled = builder.Configuration.GetValue<bool>("Consul:EnableServiceDiscovery");
if (consulEnabled)
{
    var consulAddress = builder.Configuration["Consul:Address"]!;
    var consulToken   = builder.Configuration["Consul:Token"];
    var environment   = builder.Environment.EnvironmentName.ToLower() switch
    {
        "production" => "production",
        "staging"    => "staging",
        "test"       => "test",
        _            => "dev"
    };
    builder.Configuration.AddConsul(
        $"nexora/api/{environment}/config",
        options =>
        {
            options.ConsulConfigurationOptions = cco =>
            {
                cco.Address = new Uri(consulAddress);
                if (!string.IsNullOrEmpty(consulToken)) cco.Token = consulToken;
            };
            options.Optional      = true;
            options.ReloadOnChange = true;
            options.OnLoadException = ctx => { ctx.Ignore = true; };
        });
}

builder.Host.UseSerilog((ctx, config) =>
{
    config
        .ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "Nexora")
        .Enrich.WithProperty("Environment", ctx.HostingEnvironment.EnvironmentName)
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
        .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", Serilog.Events.LogEventLevel.Fatal)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Query", Serilog.Events.LogEventLevel.Fatal)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Update", Serilog.Events.LogEventLevel.Fatal)
        .WriteTo.Console(restrictedToMinimumLevel: Serilog.Events.LogEventLevel.Warning, outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] [{CorrelationId}] [{SourceContext}] {Message:lj}{NewLine}{Exception}");

    var elkUri = ctx.Configuration["ElkSettings:Uri"];
    if (!string.IsNullOrEmpty(elkUri) && Uri.TryCreate(elkUri, UriKind.Absolute, out var elasticUri))
    {
        config.WriteTo.Elasticsearch(new ElasticsearchSinkOptions(elasticUri)
        {
            IndexFormat                 = ctx.Configuration["ElkSettings:IndexFormat"] ?? "nexora-logs-{0:yyyy.MM.dd}",
            AutoRegisterTemplate        = true,
            AutoRegisterTemplateVersion = AutoRegisterTemplateVersion.ESv7
        });
    }
});

builder.Services.AddOpenApi(options =>
    options.AddDocumentTransformer<SecuritySchemeTransformer>());

builder.Services.AddHttpContextAccessor();

// ASP.NET Core only auto-enables RouteHandlerOptions.ThrowOnBadRequest in Development, which
// means malformed JSON bodies and invalid route/query values (e.g. bad GUIDs) would otherwise
// return an empty 400 body in Production/Testing instead of throwing into
// ExceptionHandlingMiddleware to produce the standard ApiResponse envelope
// (errorCode/message/correlationId). Force it on for every environment so the error contract is
// consistent everywhere.
builder.Services.PostConfigure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(o =>
    o.ThrowOnBadRequest = true);

var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"];
if (string.IsNullOrWhiteSpace(jwtSecretKey) || Encoding.UTF8.GetByteCount(jwtSecretKey) < 32)
{
    throw new InvalidOperationException(
        "GÜVENLİK: JwtSettings:SecretKey eksik ya da 32 bayttan kısa. " +
        "Vault/appsettings üzerinden en az 32 baytlık (256-bit) güçlü bir anahtar sağlanmalıdır. " +
        "Uygulama güvenli olmayan bir imza anahtarıyla başlatılamaz.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection("JwtSettings");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwt["Issuer"],
            ValidAudience            = jwt["Audience"],
            ValidAlgorithms          = [SecurityAlgorithms.HmacSha256],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
            ClockSkew                = TimeSpan.Zero
        };
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = accessToken;
                return Task.CompletedTask;
            },
            OnChallenge = async ctx =>
            {
                var failure = ctx.AuthenticateFailure?.Message;
                if (failure == "Oturum başka bir cihazdan yenilendi." || failure == "Oturum sonlandırıldı.")
                {
                    ctx.HandleResponse();
                    ctx.Response.StatusCode  = 401;
                    ctx.Response.ContentType = "application/json";
                    var correlationId = ctx.HttpContext.Items["CorrelationId"]?.ToString();
                    await ctx.Response.WriteAsJsonAsync(new
                    {
                        success     = false,
                        statusCode  = 401,
                        errorCode   = "SESSION_INVALIDATED",
                        message     = failure,
                        correlationId,
                        timestamp   = DateTime.UtcNow,
                    });
                }
            },
            OnTokenValidated = async ctx =>
            {
                if (ctx.Principal?.FindFirstValue("type") == "otp_pending")
                {
                    ctx.Fail("Geçersiz oturum belirteci.");
                    return;
                }

                var userId = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userId)) return;

                var redis = ctx.HttpContext.RequestServices.GetService<Nexora.Application.Common.Interfaces.IRedisService>();
                if (redis is null) return;

                var userType = ctx.Principal?.FindFirstValue("user_type");

                if (userType is "admin" or "citizen" or "company" or "company_staff"
                    && Guid.TryParse(userId, out var secverAccountId))
                {
                    var uow = ctx.HttpContext.RequestServices.GetService<Nexora.Application.Common.Repositories.IUnitOfWork>();
                    if (uow is not null)
                    {
                        var tokenSecver = int.TryParse(ctx.Principal?.FindFirstValue("secver"), out var sv) ? sv : -1;
                        var rct = ctx.HttpContext.RequestAborted;
                        int? currentSecver = userType switch
                        {
                            "admin" => (await uow.AdminUsers.GetByIdAsync(secverAccountId, rct))?.SecurityVersion,
                            "citizen" => (await uow.Participants.GetByIdAsync(secverAccountId, rct))?.SecurityVersion,
                            "company" => (await uow.Companies.GetByIdAsync(secverAccountId, rct))?.SecurityVersion,
                            "company_staff" => (await uow.CompanyStaffs.GetByIdAsync(secverAccountId, rct))?.SecurityVersion,
                            _ => null
                        };
                        if (currentSecver is null || currentSecver != tokenSecver)
                        {
                            ctx.Fail("Oturum geçersiz. Lütfen tekrar giriş yapın.");
                            return;
                        }
                    }
                }

                if (userType is "citizen" or "company" or "company_staff")
                {
                    var sessionId = ctx.Principal?.FindFirstValue("sessionId");
                    if (!string.IsNullOrEmpty(sessionId))
                    {
                        var revoked = await redis.ExistsAsync($"auth:revoked-session:{sessionId}");
                        if (revoked)
                            ctx.Fail("Oturum sonlandırıldı.");
                    }
                    return;
                }

                if (!string.IsNullOrEmpty(ctx.Principal?.FindFirstValue("impersonatorId")))
                    return;

                var currentSessionId = await redis.GetAsync<string>($"auth:current-session-id:{userId}");
                if (string.IsNullOrEmpty(currentSessionId)) return;

                var tokenSessionId = ctx.Principal?.FindFirstValue("adminSessionId");
                if (!string.Equals(tokenSessionId, currentSessionId, StringComparison.Ordinal))
                    ctx.Fail("Oturum başka bir cihazdan yenilendi.");
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOrAbove", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("user_type", "admin");
    });
    options.AddPolicy("StaffOrAbove", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("user_type", "admin");
    });
    options.AddPolicy("Citizen", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("user_type", "citizen");
    });
    options.AddPolicy("Company", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("user_type", "company");
    });
    options.AddPolicy("CompanyStaff", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("user_type", "company_staff");
    });
    options.AddPolicy("CompanyOrStaff", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx =>
        {
            var userType = ctx.User.FindFirstValue("user_type");
            return userType == "company" || userType == "company_staff";
        });
    });
});

// Geliştirme ortamında CORS için: localhost ve özel ağ (RFC1918) adresleri.
// Mobil cihaz testinde uygulama LAN IP'si üzerinden bağlandığı için gereklidir.
// Yalnızca Development'ta çağrılır; canlıda açık origin listesi zorunludur.
static bool IsLocalOrPrivateHost(string host)
{
    if (host is "localhost" or "127.0.0.1" or "::1") return true;
    if (!System.Net.IPAddress.TryParse(host, out var ip)) return false;
    if (System.Net.IPAddress.IsLoopback(ip)) return true;
    if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) return false;
    var b = ip.GetAddressBytes();
    return b[0] == 10                                   // 10.0.0.0/8
        || (b[0] == 192 && b[1] == 168)                 // 192.168.0.0/16
        || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)    // 172.16.0.0/12
        || (b[0] == 169 && b[1] == 254);                // link-local
}

builder.Services.AddCors(options =>
{
    var origins = builder.Configuration.GetSection("CorsSettings:AllowedOrigins").Get<string[]>() ?? [];
    options.AddDefaultPolicy(policy =>
    {
        if (origins.Length > 0)
        {
            policy.WithOrigins(origins).AllowCredentials()
                  .AllowAnyHeader().AllowAnyMethod();

            // Kullanıcı isteği (2026-09-03): Android tablet aynı ağdaki API'ye
            // erişemiyordu. Liste yalnızca localhost adreslerini içerdiği için
            // ağdaki bir cihazdan (ör. http://192.168.1.14:3100) gelen istek
            // CORS'ta düşüyordu. Geliştirmede özel ağ (RFC1918) kaynakları da
            // kabul edilir; Production/Staging'de yalnızca açık liste geçerlidir.
            if (builder.Environment.IsDevelopment())
            {
                policy.SetIsOriginAllowed(origin =>
                    origins.Contains(origin, StringComparer.OrdinalIgnoreCase) ||
                    (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && IsLocalOrPrivateHost(uri.Host)));
            }
        }
        else if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin =>
                      Uri.TryCreate(origin, UriKind.Absolute, out var uri) && IsLocalOrPrivateHost(uri.Host))
                  .AllowCredentials()
                  .AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            var startupLogger = loggerFactory.CreateLogger("Cors");
            startupLogger.LogError(
                "GÜVENLİK: CorsSettings:AllowedOrigins boş ve ortam Production/Staging. " +
                "Tüm cross-origin istekler reddedilecek. Origin listesini Vault/Consul üzerinden tanımlayın.");
        }
    });
});

if (!builder.Environment.IsDevelopment())
{
    var cfg = builder.Configuration;
    var leaks = new List<string>();
    if (cfg.GetValue("LibraryAccess:DisableBreakTimingRules", false))
        leaks.Add("LibraryAccess:DisableBreakTimingRules=true (mola kuralları kapalı — yalnızca geliştirme içindir)");
    if (cfg.GetValue("SmsSettings:UseMockMode", false))
        leaks.Add("SmsSettings:UseMockMode=true (SMS sahte modda — gerçek gönderim yapılmaz)");
    if (cfg.GetValue("LibraryLock:AllowHttpOnPrivateNetwork", true) && !cfg.GetValue("LibraryLock:UseHttps", false))
        leaks.Add("LibraryLock: HTTP + AllowHttpOnPrivateNetwork açık (kilit kimlik bilgisi düz metin gidebilir)");
    var devKeys = (cfg.GetSection("PublicApi:ApiKeys").Get<string[]>() ?? []).Where(k => k.StartsWith("dev-", StringComparison.OrdinalIgnoreCase)).ToArray();
    if (devKeys.Length > 0)
        leaks.Add($"PublicApi:ApiKeys içinde geliştirme anahtarı ('{devKeys[0]}') — Vault'tan gerçek anahtar tanımlayın");
    if (cfg.GetValue("Seed:Demo:Enabled", false))
        leaks.Add("Seed:Demo:Enabled=true (demo firma/vatandaş seed'i — yalnızca geliştirme/test içindir, prod'da sabit kimlikli hesap oluşturur)");
    // 2026-07-30 denetiminde eklendi (P0): Nvi:UseMockMode kontrolü bu listede hiç
    // yoktu. Bu bayrak açıkken /auth/citizen/nvi-lookup gerçek NVI (Nüfus ve
    // Vatandaşlık İşleri) servisine sorgu atmıyor, sadece checksum'ı geçen (gerçek
    // olması gerekmeyen) herhangi bir TC kimlik numarasını "doğrulanmış gerçek kişi"
    // gibi kabul ediyor — canlı testte checksum-geçerli ama uydurma bir TC ile tam
    // yetkili vatandaş hesabı (welcome bonus + kampanya haklarıyla) açılabildi.
    if (cfg.GetValue("Nvi:UseMockMode", false))
        leaks.Add("Nvi:UseMockMode=true (NVI kimlik doğrulama sahte modda — checksum'ı geçen uydurma TC'lerle gerçek vatandaş hesabı açılabilir)");
    // 2026-07-30 denetiminde eklendi (P1): OtpSettings:MockCode doluysa OTP her
    // zaman bu sabit koda düşer (RandomNumberGenerator ile üretilen gerçek kod
    // yerine) — bu, tüm admin/vatandaş/firma 2FA'sını fiilen devre dışı bırakan
    // sessiz bir hata senaryosudur, hiçbir uyarı vermeden prod'da çalışmaya devam eder.
    // 2026-09-18: yerel Docker Compose dev ortamında SMS/e-posta gerçekten
    // gönderilemediği (Vault'ta kimlik bilgisi yok) için OTP'yi test edilebilir
    // kılmak amacıyla sabit koda izin veren AÇIK bir opt-in bayrağı eklendi.
    // Bu bayrak sadece docker-compose.yml içinde set edilir; gerçek prod
    // deploy'unda appsettings.Production.json'da bulunmadığından varsayılan
    // false kalır ve guard normal şekilde çalışmaya devam eder.
    var allowMockOtpLocally = cfg.GetValue("LocalDockerDev:AllowMockOtp", false);
    if (!string.IsNullOrWhiteSpace(cfg["OtpSettings:MockCode"]) && !allowMockOtpLocally)
        leaks.Add("OtpSettings:MockCode dolu (OTP sabit koda düşüyor — 2FA fiilen devre dışı kalır)");
    if (cfg.GetValue("SmsSettings:AllowInvalidServerCertificate", false))
        leaks.Add("SmsSettings:AllowInvalidServerCertificate=true (SMS TLS doğrulaması kapalı — MITM saldırısına açıktır)");

    if (leaks.Count > 0)
    {
        var securityMessage = "GÜVENLİK: Geliştirme dışı ortamda tehlikeli geliştirme ayarları tespit edildi:\n - "
            + string.Join("\n - ", leaks);
        if (builder.Environment.IsProduction())
            throw new InvalidOperationException(securityMessage + "\nÜretim ortamında başlatma durduruldu.");
        loggerFactory.CreateLogger("Startup").LogWarning("{SecurityMessage}", securityMessage);
    }
}

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    var authPermitLimit   = builder.Configuration.GetValue("RateLimiting:AuthPermitLimit", 10);
    var authWindowSeconds = builder.Configuration.GetValue("RateLimiting:AuthWindowSeconds", 60);
    var globalPermitLimit = builder.Configuration.GetValue("RateLimiting:GlobalPermitLimit", 1000);
    var globalWindowSecs  = builder.Configuration.GetValue("RateLimiting:GlobalWindowSeconds", 60);
    var devicePermitLimit  = builder.Configuration.GetValue("RateLimiting:DevicePermitLimit", 120);
    var deviceWindowSeconds = builder.Configuration.GetValue("RateLimiting:DeviceWindowSeconds", 60);
    var aiServiceIps = builder.Configuration.GetSection("RateLimiting:AiServiceIps").Get<string[]>() ?? [];
    var aiServicePermitLimit = builder.Configuration.GetValue("RateLimiting:AiServicePermitLimit", 20000);

    options.AddPolicy("auth", httpContext =>
        CreateAuthOrDeviceLimiterPartition(
            httpContext,
            policyName: "auth",
            permitLimit: authPermitLimit,
            window: TimeSpan.FromSeconds(authWindowSeconds)));

    options.AddPolicy("device", httpContext =>
        CreateAuthOrDeviceLimiterPartition(
            httpContext,
            policyName: "device",
            permitLimit: devicePermitLimit,
            window: TimeSpan.FromSeconds(deviceWindowSeconds)));

    options.AddPolicy("test-support", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: TestSupportEndpoints.GetRateLimitPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var path = httpContext.Request.Path;
        if (path.StartsWithSegments("/api/v1/library-device") || path.StartsWithSegments("/api/v1/device"))
            return RateLimitPartition.GetNoLimiter("device-webhook");

        if (path.StartsWithSegments("/health"))
            return RateLimitPartition.GetNoLimiter("health");

        var clientIp = GetClientIp(httpContext);

        // Yapay zekâ servisi (2026-10-06): tüm vatandaşlar için token doğrulamasını
        // (/auth/citizen/introspect) tek sunucu IP'sinden yapar; IP başına genel limit
        // yoğun saatte 429'a düşürür. Yalnız bu IP'lere ayrı, yüksek limitli bölüm.
        if (aiServiceIps.Length > 0 && Nexora.Domain.Common.IpMatcher.Matches(clientIp, aiServiceIps))
            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: "ai-service:" + clientIp,
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = aiServicePermitLimit,
                    Window = TimeSpan.FromSeconds(globalWindowSecs),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                });

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: clientIp,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = globalPermitLimit,
                Window = TimeSpan.FromSeconds(globalWindowSecs),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        var correlationId = context.HttpContext.Items["CorrelationId"]?.ToString();
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            success    = false,
            statusCode = 429,
            errorCode  = "RATE_LIMIT_EXCEEDED",
            message    = "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.",
            correlationId,
            timestamp  = DateTime.UtcNow,
        }, token);
    };

    static string GetClientIp(HttpContext ctx)
    {
        // 2026-07-30 denetiminde tespit edildi (P0): bu fonksiyon güvenilir proxy
        // kontrolü olmadan X-Forwarded-For header'ına doğrudan güveniyordu. Bir
        // saldırgan her istekte rastgele bir sahte X-Forwarded-For değeri göndererek
        // IP bazlı rate-limit'i (auth/device/global) tamamen atlatabiliyordu — canlı
        // testte 40 sahte XFF ile hiçbiri limitlenmedi. CurrentUser.ResolveIpAddress
        // içindeki doğru desenle (Security:TrustedProxies config'i, IpMatcher ile
        // CIDR/tekil IP eşleşmesi) tutarlı hale getirildi: XFF/X-Real-IP başlıkları
        // yalnızca bağlantı gerçekten güvenilir bir proxy'den (nginx/load balancer)
        // geliyorsa dikkate alınır; aksi halde doğrudan TCP bağlantı IP'si kullanılır.
        var remote = ctx.Connection.RemoteIpAddress;
        var connectionIp = NormalizeClientIp(remote?.ToString()) ?? "unknown";

        var trusted = ctx.RequestServices.GetRequiredService<IConfiguration>()
            .GetSection("Security:TrustedProxies").Get<string[]>();
        // F03 (denetim 2026-09-16): TrustedProxies yapılandırılmamışken bu fonksiyon da
        // (CurrentUser.ResolveIpAddress ile aynı hatayı taşıyarak) tüm kaynaklara güveniyordu.
        // Güvenli varsayılan: liste boşsa forwarded header'lara güvenilmez.
        var shouldTrustForwardedHeaders = trusted is not null && trusted.Length > 0
            && remote is not null && Nexora.Domain.Common.IpMatcher.Matches(remote.ToString(), trusted);

        if (!shouldTrustForwardedHeaders)
            return connectionIp;

        var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var firstHop = NormalizeClientIp(forwarded.Split(',')[0]);
            if (!string.IsNullOrEmpty(firstHop)) return firstHop;
        }

        var realIp = NormalizeClientIp(ctx.Request.Headers["X-Real-IP"].FirstOrDefault());
        if (!string.IsNullOrEmpty(realIp)) return realIp;

        return connectionIp;
    }

    static string? NormalizeClientIp(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var value = raw.Trim();
        if (System.Net.IPAddress.TryParse(value, out var parsed))
            return parsed.IsIPv4MappedToIPv6 ? parsed.MapToIPv4().ToString() : parsed.ToString();
        return value;
    }

    // 2026-09-07 denetiminde tespit edildi: nginx-lb.conf üç backend instance'ı
    // arasında yük dağıtıyor (least_conn). RateLimitPartition.GetFixedWindowLimiter
    // sayacı PROCESS BELLEĞİNDE tutar; her instance kendi ayrı sayacına sahip
    // olduğu için canlıda tasarlanan limitin (auth: 30/60sn) ~3 katına kadar
    // aşılabildiği doğrulandı (40+ ardışık istek, sabit IP, hiç 429 üretmedi).
    //
    // Redis yapılandırılmışsa (IRedisService/IConnectionMultiplexer DI'da
    // kayıtlıysa — bkz. Infrastructure/DependencyInjection.cs) sayaç oradan
    // paylaşılır ve tüm instance'lar aynı toplamı görür. Redis yoksa (yerel
    // geliştirme gibi) mevcut in-memory limiter'a sessizce düşülür; böylece
    // Redis'siz ortamlarda uygulama başlatma hatası ya da korumasız kalma
    // riski oluşmaz.
    static RateLimitPartition<string> CreateAuthOrDeviceLimiterPartition(
        HttpContext httpContext, string policyName, int permitLimit, TimeSpan window)
    {
        var partitionKey = GetClientIp(httpContext);
        var redis = httpContext.RequestServices.GetService<IConnectionMultiplexer>();

        if (redis is not null)
        {
            return RateLimitPartition.Get(
                partitionKey: $"{policyName}:{partitionKey}",
                factory: key => new RedisFixedWindowRateLimiter(redis, key, permitLimit, window));
        }

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    }
});

var mapsterConfig = MappingConfig.Configure();
builder.Services.AddSingleton(mapsterConfig);
builder.Services.AddScoped<IMapper, ServiceMapper>();

builder.Services.AddValidatorsFromAssemblyContaining<Nexora.Application.AssemblyMarker>();

builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
var signalRRedis = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(signalRRedis))
{
    builder.Services.AddSignalR().AddStackExchangeRedis(signalRRedis, o =>
    {
        o.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("nexora-signalr");
    });
}
builder.Services.AddSingleton<Nexora.Application.Features.Team.ITeamRealtimeNotifier, Nexora.Api.Hubs.TeamRealtimeNotifier>();
builder.Services.AddSingleton<Nexora.Application.Features.Notifications.INotificationRealtimeNotifier, Nexora.Api.Hubs.NotificationRealtimeNotifier>();
builder.Services.AddSingleton<Nexora.Application.Features.Libraries.ILibrarySessionRealtimeNotifier, Nexora.Api.Hubs.LibrarySessionRealtimeNotifier>();
builder.Services.AddSingleton<Nexora.Application.Features.DeviceMonitor.IDeviceMonitorNotifier, Nexora.Api.Hubs.DeviceMonitorNotifier>();
builder.Services.AddSingleton<Nexora.Application.Common.Interfaces.IDashboardRealtimeNotifier, Nexora.Api.Hubs.DashboardRealtimeNotifier>();
builder.Services.AddSingleton<Nexora.Application.Features.MobileConfig.IMobileConfigRealtimeNotifier, Nexora.Api.Hubs.MobileConfigRealtimeNotifier>();

builder.Services.AddMemoryCache();
builder.Services.AddScoped<Nexora.Api.Common.PublicApiKeyFilter>();

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes
        .Concat(new[] { "application/json" });
});
builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);

builder.Services
    .AddHealthChecks()
    .AddInfrastructureHealthChecks(builder.Configuration);

var app = builder.Build();

app.UseCors();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseResponseCompression();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<ResponseWrappingMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<MustChangePasswordMiddleware>();
app.UseMiddleware<PermissionEnforcementMiddleware>();
// Online kullanıcı takibi: kimlik doğrulandıktan sonra, yalnız Redis'e ucuz bir işaret bırakır.
app.UseMiddleware<OnlineTrackingMiddleware>();

// 2026-07-30 denetiminde tespit edildi: önceden "!IsProduction()" (blacklist mantığı)
// kullanılıyordu. Bu, gelecekte bir "Staging" ortamı eklenirse (ASPNETCORE_ENVIRONMENT=Staging)
// veya env değişkeni deploy sırasında yanlışlıkla boş/hatalı yazılırsa (örn. "Producton" typo'su),
// Dev-only endpoint'lerin (Scalar API dokümantasyonu, /api/v1/dev/test/* — NVI test sorgusu,
// manuel job tetikleyicileri) sessizce prod-benzeri bir ortamda açık kalmasına yol açabilirdi.
// Artık açık bir whitelist (yalnızca gerçek "Development" ortamı) kullanılıyor.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.Title              = "Nexora API";
        options.Theme              = ScalarTheme.Purple;
        options.DefaultHttpClient  = new(ScalarTarget.CSharp, ScalarClient.HttpClient);
    });
    app.MapDevTestEndpoints();
}

if (TestSupportEndpoints.IsEnabled(app.Environment.EnvironmentName))
    app.MapTestSupportEndpoints();

var hangfireEnabled = builder.Configuration.GetValue("Hangfire:Enabled", false);
if (hangfireEnabled && app.Services.GetService<Hangfire.JobStorage>() is not null)
{
    var hfUser = builder.Configuration["Hangfire:DashboardUser"];
    var hfPass = builder.Configuration["Hangfire:DashboardPassword"];

    // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #2): Vault/appsettings.Production.json
    // zincirinde Hangfire:DashboardUser/DashboardPassword hiç sağlanmıyordu — boş string ile dashboard
    // sessizce mount ediliyordu. Doğrulama testiyle (HangfireAuthFilter.Authorize'daki `separator > 0`
    // kontrolü) boş:boş kombinasyonuyla Basic-Auth'un fiilen bypass EDİLEMEDİĞİ kanıtlandı (kilitli
    // kalıyor, açık kalmıyor) — ama bu örtük/kırılgan bir korumaydı, gelecekteki bir kod değişikliğinde
    // bozulabilirdi. Artık açıkça: kimlik bilgileri boşsa dashboard hiç mount edilmiyor (fail-safe,
    // sessiz-güvensiz-varsayılan yerine net bir log uyarısı).
    if (string.IsNullOrWhiteSpace(hfUser) || string.IsNullOrWhiteSpace(hfPass))
    {
        app.Logger.LogWarning(
            "Hangfire:DashboardUser/DashboardPassword yapılandırılmamış — /hangfire paneli GÜVENLİK GEREĞİ mount edilmedi. " +
            "Vault/appsettings.Production.json üzerinden bu değerleri sağlayın.");
    }
    else
    {
        app.MapHangfireDashboard("/hangfire", new DashboardOptions
        {
            Authorization = [new HangfireAuthFilter(hfUser, hfPass)],
            AppPath       = "/"
        });
    }
}

app.MapHub<Nexora.Api.Hubs.TeamHub>("/hubs/team");
app.MapHub<Nexora.Api.Hubs.CitizenHub>("/hubs/citizen");
app.MapHub<Nexora.Api.Hubs.DeviceMonitorHub>("/hubs/device-monitor");
app.MapHub<Nexora.Api.Hubs.MobileConfigHub>("/hubs/mobile-config");

var endpoints = app.MapGroup("");
endpoints.MapFileEndpoints();
endpoints.MapHealthEndpoints();
endpoints.MapAuthEndpoints();
endpoints.MapParticipantAuthEndpoints();
endpoints.MapAdminEndpoints();
endpoints.MapDepartmentEndpoints();
endpoints.MapRoleEndpoints();
endpoints.MapPermissionEndpoints();
endpoints.MapAuditLogEndpoints();
endpoints.MapSmsAuditEndpoints();
endpoints.MapSmsSendEndpoints();
endpoints.MapSmsPermissionEndpoints();
endpoints.MapParticipantEndpoints();
endpoints.MapParticipantServiceUsageEndpoints();
endpoints.MapParticipantEventEndpoints();
// Kullanıcı isteği (2026-10-01): üst başlıktaki arama kutusunun gerçek veri (tesis/grup/başvuru/
// katılımcı) araması yapabilmesi için eklendi — bkz. GlobalSearchEndpoints.cs.
Nexora.Api.Endpoints.Search.GlobalSearchEndpoints.MapGlobalSearchEndpoints(endpoints);
Nexora.Api.Endpoints.Search.CitizenSearchEndpoints.MapCitizenSearchEndpoints(endpoints);
endpoints.MapServiceFacilityEndpoints();
endpoints.MapEmergencyAreaEndpoints();
endpoints.MapGiftEndpoints();
endpoints.MapWheelEndpoints();
endpoints.MapGiftRequestEndpoints();
endpoints.MapWheelSpinEndpoints();
endpoints.MapPopupEndpoints();
endpoints.MapMePopupEndpoints();
endpoints.MapCitizenSubmissionEndpoints();
endpoints.MapCitizenMenuEndpoints();
endpoints.MapMobileMenuAdminEndpoints();
endpoints.MapMobileMenuPublicEndpoints();
endpoints.MapMobileMenuAnonymousEndpoints();
endpoints.MapMobileConfigAdminEndpoints();
endpoints.MapMobileConfigPublicEndpoints();
endpoints.MapSystemBrandingAdminEndpoints();
endpoints.MapSystemBrandingPublicEndpoints();
endpoints.MapAppMenuAdminEndpoints();
endpoints.MapAppMenuPublicEndpoints();
endpoints.MapPublicCatalogEndpoints();
endpoints.MapAiCatalogEndpoints();
endpoints.MapTopMenuEndpoints();
endpoints.MapLibraryEndpoints();
endpoints.MapAnalyticsEndpoints();
endpoints.MapReportsEndpoints();
endpoints.MapLibrarySettingsEndpoints();
endpoints.MapLibraryTemplateEndpoints();
endpoints.MapLibraryRuleEndpoints();
endpoints.MapLibraryOperationsEndpoints();
endpoints.MapLibraryMesaiEndpoints();
endpoints.MapLibraryDeviceEndpoints();
endpoints.MapDeviceMonitorEndpoints();
endpoints.MapLibraryApplicationEndpoints();
endpoints.MapHallEndpoints();
endpoints.MapEventCategoryEndpoints();
endpoints.MapEventSettingsEndpoints();
endpoints.MapIntegrationSettingsEndpoints();
endpoints.MapCorporateProxyEndpoints();
endpoints.MapEventEndpoints();
endpoints.MapSessionEndpoints();
endpoints.MapEventApplicationEndpoints();
endpoints.MapQuizCategoryEndpoints();
endpoints.MapQuizAgeGroupEndpoints();
endpoints.MapQuizEndpoints();
endpoints.MapSurveyEndpoints();
endpoints.MapSurveyPlatformEndpoints();
endpoints.MapTravelCategoryEndpoints();
endpoints.MapTravelRouteEndpoints();
endpoints.MapTravelEndpoints();
endpoints.MapTravelBusEndpoints();
endpoints.MapTravelApplicationEndpoints();
endpoints.MapTravelSettingsEndpoints();
endpoints.MapTravelBoardingEndpoints();
endpoints.MapTravelAttendanceEndpoints();
endpoints.MapMeEventEndpoints();
endpoints.MapMeFacilityEndpoints();
endpoints.MapMeAccessibleEndpoints();
endpoints.MapMeAppointmentKeyEndpoints();
endpoints.MapMeLibraryEndpoints();
endpoints.MapMeTravelEndpoints();
endpoints.MapMeNotificationEndpoints();
endpoints.MapMeNotificationPreferenceEndpoints();
endpoints.MapMeDevicePermissionEndpoints();
endpoints.MapMePresenceEndpoints();
endpoints.MapMeTeamEndpoints();
endpoints.MapMeEmergencyAreaEndpoints();
endpoints.MapMeDutyPharmacyEndpoints();
endpoints.MapMeCampaignEndpoints();
endpoints.MapMeBakkartEndpoints();
endpoints.MapMeWheelEndpoints();
endpoints.MapMeSubmissionEndpoints();
endpoints.MapMeQuizEndpoints();
endpoints.MapMeSurveyEndpoints();
endpoints.MapMeHistoryEndpoints();
endpoints.MapMeSedaEndpoints();
endpoints.MapMeIdentityEndpoints();
endpoints.MapMeTodayPlanEndpoints();
endpoints.MapMeLiveMapEndpoints();
endpoints.MapAttendanceEndpoints();
endpoints.MapScanEndpoints();
endpoints.MapDeviceEndpoints();
endpoints.MapSedaEndpoints();
endpoints.MapCompanyEndpoints();
endpoints.MapCompanySettingsEndpoints();
endpoints.MapCampaignEndpoints();
endpoints.MapServiceCategoryEndpoints();
endpoints.MapDiscountUsageEndpoints();
endpoints.MapCampaignRedemptionEndpoints();
endpoints.MapBakkartEndpoints();
endpoints.MapCompanyAuthEndpoints();
endpoints.MapCompanyMeEndpoints();
endpoints.MapBusinessValidationEndpoints();
endpoints.MapCompanyStaffAuthEndpoints();
endpoints.MapCitizenQrEndpoints();
endpoints.MapCompanyQrEndpoints();
endpoints.MapBroadcastEndpoints();
endpoints.MapBirthdayEndpoints();
endpoints.MapLoyaltyEndpoints();
endpoints.MapEducationEndpoints();
endpoints.MapDutyPharmacyAdminEndpoints();

foreach (var facilityModule in Nexora.Application.Features.Facilities.FacilityModuleRegistry.All)
    Nexora.Api.Endpoints.Facilities.FacilityModuleEndpoints.MapFacilityModuleEndpoints(endpoints, facilityModule);

// Task 14 (pre-launch test architecture, migration-integrity gate): this codebase runs 3
// horizontally-scaled API instances (nexora-api-1/2/3, docker-compose.yml) that all start
// against the same Postgres database with no leader election. Previously every instance
// called GetPendingMigrationsAsync/MigrateAsync concurrently with no coordination (a real
// concurrent-DDL race hazard) and swallowed migration exceptions into a LogWarning, letting
// an instance boot and serve traffic against a schema mismatched to its code. Fixed by
// taking a session-scoped Postgres advisory lock (same pg_advisory_lock/pg_advisory_xact_lock
// family already used by IUnitOfWork.AcquireAdvisoryLockAsync elsewhere in this codebase) on
// a fixed, well-known key before checking/applying migrations, so only one instance migrates
// at a time and the others block until it finishes (not skip — a genuinely pending migration
// must still be seen and is a no-op via __EFMigrationsHistory once the first instance applies
// it). The exception is now rethrown (fails startup) instead of swallowed, so a real migration
// failure stops that instance from serving traffic against a schema it doesn't match.
const long MigrationAdvisoryLockKey = 875_309_001; // fixed, well-known key for this one lock's purpose only
await using (var migrationLockConnection = new Npgsql.NpgsqlConnection(
    app.Configuration.GetConnectionString("PostgreSQL")))
{
    await migrationLockConnection.OpenAsync();
    var startLog = app.Services.GetRequiredService<ILogger<Program>>();
    startLog.LogInformation("Waiting for migration advisory lock (key {Key})...", MigrationAdvisoryLockKey);
    await using (var lockCmd = migrationLockConnection.CreateCommand())
    {
        lockCmd.CommandText = "SELECT pg_advisory_lock(@key)";
        lockCmd.Parameters.AddWithValue("key", MigrationAdvisoryLockKey);
        await lockCmd.ExecuteNonQueryAsync();
    }

    try
    {
        using var scope = app.Services.CreateScope();
        var db      = scope.ServiceProvider.GetRequiredService<Nexora.Infrastructure.Persistence.AppDbContext>();
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pending.Count > 0)
        {
            startLog.LogInformation("Applying {Count} pending migration(s): {Names}", pending.Count, string.Join(", ", pending));
            await db.Database.MigrateAsync();
        }
    }
    catch (Exception ex)
    {
        startLog.LogCritical(ex, "Migration failed — failing startup rather than serving traffic against a mismatched schema");
        throw;
    }
    finally
    {
        await using var unlockCmd = migrationLockConnection.CreateCommand();
        unlockCmd.CommandText = "SELECT pg_advisory_unlock(@key)";
        unlockCmd.Parameters.AddWithValue("key", MigrationAdvisoryLockKey);
        await unlockCmd.ExecuteNonQueryAsync();
    }
}

await Nexora.Infrastructure.Persistence.DatabaseSeeder.SeedAsync(app.Services);

app.Run();
