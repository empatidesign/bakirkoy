using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Services;

public class JwtService(IConfiguration configuration) : IJwtService
{
    private readonly string _secretKey = configuration["JwtSettings:SecretKey"]!;
    private readonly string _issuer = configuration["JwtSettings:Issuer"]!;
    private readonly string _audience = configuration["JwtSettings:Audience"]!;
    private readonly int _accessTokenMinutes = configuration.GetValue("JwtSettings:AccessTokenMinutes", 60);

    public string GenerateAccessToken(AdminUser user, bool isSuperAdmin, string? roleName, Guid sessionId, Guid? impersonatorId = null)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("user_type", "admin"),
            new Claim("is_super_admin", isSuperAdmin ? "true" : "false"),
            new Claim("role_name", roleName ?? ""),
            new Claim("adminSessionId", sessionId.ToString()),
            new Claim("must_change_password", user.MustChangePassword ? "true" : "false"),
            new Claim("secver", user.SecurityVersion.ToString()),
        };
        if (impersonatorId is Guid imp)
            claims.Add(new Claim("impersonatorId", imp.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_accessTokenMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateCitizenAccessToken(Participant participant, Guid sessionId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, participant.Id.ToString()),
            new Claim(ClaimTypes.Name, participant.FullName),
            new Claim("user_type", "citizen"),
            new Claim("sessionId", sessionId.ToString()),
            new Claim("must_change_password", participant.MustChangePassword ? "true" : "false"),
            new Claim("secver", participant.SecurityVersion.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_accessTokenMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateCompanyAccessToken(Company company, Guid sessionId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, company.Id.ToString()),
            new Claim(ClaimTypes.Name, company.Name),
            new Claim("user_type", "company"),
            new Claim("sessionId", sessionId.ToString()),
            new Claim("must_change_password", company.IsFirstLogin ? "true" : "false"),
            new Claim("secver", company.SecurityVersion.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_accessTokenMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateCompanyStaffAccessToken(CompanyStaff staff, Guid sessionId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staff.Id.ToString()),
            new Claim(ClaimTypes.Name, staff.FullName),
            new Claim("user_type", "company_staff"),
            new Claim("companyId", staff.CompanyId.ToString()),
            new Claim("can_redeem", staff.CanRedeem ? "true" : "false"),
            new Claim("can_manage_campaigns", staff.CanManageCampaigns ? "true" : "false"),
            new Claim("sessionId", sessionId.ToString()),
            new Claim("secver", staff.SecurityVersion.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_accessTokenMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private string PendingOtpAudience => _audience + ":otp-pending";

    public string GeneratePendingOtpToken(Guid userId, string pwdFingerprint = "")
    {
        var claims = new List<Claim>
        {
            new Claim("sub", userId.ToString()),
            new Claim("type", "otp_pending"),
        };
        if (!string.IsNullOrEmpty(pwdFingerprint))
            claims.Add(new Claim("pwd", pwdFingerprint));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: PendingOtpAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (Guid UserId, string PwdFingerprint)? ValidatePendingOtpToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));

            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _issuer,
                ValidAudience = PendingOtpAudience,
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                IssuerSigningKey = key,
                ClockSkew = TimeSpan.Zero,
            }, out _);

            var type = principal.FindFirstValue("type");
            if (type != "otp_pending") return null;

            var sub = principal.FindFirstValue("sub");
            if (!Guid.TryParse(sub, out var id)) return null;

            var pwd = principal.FindFirstValue("pwd") ?? "";
            return (id, pwd);
        }
        catch
        {
            return null;
        }
    }
}
