using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Nexora.Api.Endpoints.TestSupport;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Participants;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Api.IntegrationTests.Libraries;

// Task 9: `WithWebHostBuilder(...)` (used to scope a config override, e.g. LibraryLock:UseHttps,
// to a single test without mutating the shared NexoraApiFactory every other test in this
// collection uses) returns the BASE `WebApplicationFactory<ResidueResponse>` type, not
// `NexoraApiFactory` — so `CreateClientAsync`/`CreateCitizenClientAsync` (defined on the concrete
// sealed class) are not directly callable on it. This helper mints admin/citizen tokens against
// ANY WebApplicationFactory<ResidueResponse> using the exact same claim shape/signing key the
// Testing host's own JwtSettings expose via environment variables (set process-wide by
// NexoraApiFactory.ApplyEarlyConfiguration before any host in this process builds), so the real
// authentication/authorization pipeline runs unchanged regardless of which specific factory
// instance issued the token.
internal static class ScopedFactoryAuth
{
    public static async Task<HttpClient> CreateAdminClientAsync(this WebApplicationFactory<ResidueResponse> factory, Guid userId, string email)
    {
        // Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu): bu token
        // üretici c1bd741 (SecurityVersion tabanlı oturum geçersizleştirme) sonrası "secver"
        // claim'ini hiç üretmiyordu — kardeş dosya FacilityCitizenTokenHelper 61721f0'da
        // düzeltilmişti ama bu paralel yardımcı gözden kaçmıştı. Redis-enabled test host'larında
        // (bu sınıfın kullandığı NexoraApiFactory.CreateForCollectionWithRedis) Program.cs'teki
        // OnTokenValidated, token'daki "secver"i DB'deki güncel SecurityVersion ile karşılaştırır;
        // claim eksik olduğunda "0" değeri varsayılmaz, doğrulama tamamen BAŞARISIZ olup 401
        // UNAUTHORIZED döner — bu yüzden bu yardımcıyı kullanan her test (LibraryScenario.CreateAsync
        // dahil, admin client ile ilk servis-tesisi POST'unu yapar) sessizce 401 alıyordu.
        int securityVersion;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.AdminUsers.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
            if (existing is null)
            {
                var role = Role.Create("SuperAdmin", "SuperAdmin", "seed");
                role.SetIsSuperAdmin(true);
                var existingRole = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == "SuperAdmin");
                var roleId = existingRole?.Id ?? role.Id;
                if (existingRole is null)
                {
                    await db.Roles.AddAsync(role);
                    await db.SaveChangesAsync();
                }
                var admin = AdminUser.Create("T9 Scoped Admin", email, null, null, "x", roleId);
                admin.Id = userId;
                admin.CompletePasswordChange("x");
                await db.AdminUsers.AddAsync(admin);
                await db.SaveChangesAsync();
                securityVersion = admin.SecurityVersion;
            }
            else
            {
                securityVersion = existing.SecurityVersion;
            }
        }

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateAdminToken(userId, email, securityVersion));
        return client;
    }

    public static async Task<HttpClient> CreateCitizenClientAsync(this WebApplicationFactory<ResidueResponse> factory, CitizenTestIdentity identity)
    {
        int securityVersion;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.Participants.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == identity.ParticipantId);
            if (existing is null)
            {
                var participant = Participant.Create(
                    identity.Tckn, identity.FullName, identity.BirthDate, identity.Gender,
                    isMinor: false, passwordHash: "x", email: identity.Email, phone: identity.Phone,
                    guardianPhone: null, guardianEmail: null, address: identity.Address);
                participant.Id = identity.ParticipantId;
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

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateCitizenToken(identity, securityVersion));
        return client;
    }

    // Same literal values NexoraApiFactory uses (private there); the Testing host reads these
    // via the same-named environment variables set process-wide, so any factory in this process
    // validates tokens signed with this exact secret/issuer/audience identically.
    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    private static string CreateAdminToken(Guid userId, string email, int securityVersion = 0)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, "T9 Scoped Admin"),
            new Claim(ClaimTypes.Email, email),
            new Claim("user_type", "admin"),
            new Claim("is_super_admin", "true"),
            new Claim("role_name", "SuperAdmin"),
            new Claim("adminSessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
            new Claim("secver", securityVersion.ToString()),
        };
        return WriteToken(claims);
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
            new Claim("secver", securityVersion.ToString()),
        };
        return WriteToken(claims);
    }

    private static string WriteToken(Claim[] claims)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: JwtIssuer, audience: JwtAudience, claims: claims,
            notBefore: now, expires: now.AddMinutes(30), signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
