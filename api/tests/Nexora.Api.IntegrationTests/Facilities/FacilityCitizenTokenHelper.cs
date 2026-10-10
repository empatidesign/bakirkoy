using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Api.IntegrationTests.Facilities;

// Task 7 (Static-QR attendance case, Ruling A): the static-QR scan endpoint
// (POST /api/v1/me/facilities/static-scan) requires the "Citizen" auth policy, a genuinely
// different identity class from every other endpoint this matrix exercises (all AdminOrAbove).
// This mints a REAL citizen JWT (same claim shape as JwtService.GenerateCitizenAccessToken,
// verified by reading that file) for a REAL Participant row created directly in the real
// PostgreSQL database with a Tckn matching an already-registered FacilityRegistration — matching
// exactly how ScanStaticQrAsync resolves candidates (by Participant.Tckn, not by
// FacilityRegistration.ParticipantId, confirmed by reading FacilityAttendanceService.
// ScanStaticQrAsync before relying on this). This is intentionally a THIN, additive helper file
// (not an edit to the shared NexoraApiFactory.cs) to minimize collision risk with other agents
// concurrently touching that file in this non-worktree-isolated repo.
internal static class FacilityCitizenTokenHelper
{
    // Must match JwtService's private constants exactly, which in turn must match
    // NexoraApiFactory's JwtSecret/Issuer/Audience (all four already kept in lock-step by the
    // existing test host setup) so the token validates against the real hosted auth pipeline.
    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    public static async Task<string> CreateCitizenTokenForRegistrationAsync(this NexoraApiFactory factory, Guid registrationId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var registration = await db.FacilityRegistrations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == registrationId)
            ?? throw new InvalidOperationException($"Registration {registrationId} not found for citizen token minting.");

        var existing = await db.Participants.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Tckn == registration.Tckn);
        Guid participantId;
        if (existing is not null)
        {
            participantId = existing.Id;
        }
        else
        {
            var participant = Participant.Create(
                registration.Tckn,
                registration.FullName,
                registration.BirthDate ?? DateTime.UtcNow.AddYears(-30),
                Gender.Unknown,
                isMinor: false,
                passwordHash: "x",
                email: null,
                phone: registration.Phone,
                guardianPhone: null,
                guardianEmail: null,
                address: null);
            await db.Participants.AddAsync(participant);
            await db.SaveChangesAsync();
            participantId = participant.Id;
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, participantId.ToString()),
            new Claim(ClaimTypes.Name, registration.FullName),
            new Claim("user_type", "citizen"),
            new Claim("sessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
            // c1bd741 (SecurityVersion tabanlı oturum geçersizleştirme): OnTokenValidated
            // (Program.cs) Redis-enabled hostlarda token'daki "secver" claim'ini DB'deki güncel
            // SecurityVersion ile karşılaştırır. Participant.Create hiçbir yerde SecurityVersion'ı
            // artırmadığından (yalnız CompleteInitialPassword/ChangePassword gibi çağrılar artırır,
            // burada hiç çağrılmıyor), taze veya mevcut kayıt için sabit "0" gerçek DB değerini
            // doğru yansıtır.
            new Claim("secver", "0"),
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
