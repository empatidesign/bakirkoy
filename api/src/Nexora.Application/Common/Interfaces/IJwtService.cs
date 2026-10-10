using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(AdminUser user, bool isSuperAdmin, string? roleName, Guid sessionId, Guid? impersonatorId = null);
    string GenerateCitizenAccessToken(Participant participant, Guid sessionId);
    string GenerateCompanyAccessToken(Company company, Guid sessionId);
    string GenerateCompanyStaffAccessToken(CompanyStaff staff, Guid sessionId);
    string GenerateRefreshToken();

    /// <summary>
    /// pwdFingerprint: token üretim anındaki şifre hash'inin kısa özeti
    /// (bkz. Nexora.Infrastructure.Security.PasswordFingerprint). OTP
    /// doğrulanırken güncel şifreyle karşılaştırılıp, şifre bu sırada
    /// değiştiyse (ör. paralel şifre sıfırlama) oturumun reddedilmesini
    /// sağlar — 2026-09-22 bulgusu, bkz. PasswordFingerprint.cs.
    /// Boş string ise (ör. henüz hash'i olmayan akışlarda) kontrol atlanır.
    /// </summary>
    string GeneratePendingOtpToken(Guid userId, string pwdFingerprint = "");

    /// <summary>Doğrulanan token'ın (userId, pwdFingerprint) çiftini döner; token geçersiz/süresi dolmuşsa null.</summary>
    (Guid UserId, string PwdFingerprint)? ValidatePendingOtpToken(string token);
}
