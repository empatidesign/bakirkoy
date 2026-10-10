using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.CompanyAuth.Dtos;

public record CompanyRegisterRequest(
    string Name,
    string TaxNumber,
    string Phone,
    string? Email,
    string Address,
    string? District,
    string Password,
    Guid? ServiceCategoryId,
    double? Latitude,
    double? Longitude,
    bool KvkkAccepted = false,
    bool NotificationConsentAccepted = false);

public record CompanyRegisterResultDto(bool Success, string Message);

public record CompanyLoginRequest(string Identifier, string Password);

public record CompanyLoginResponseDto(
    bool RequiresOtp,
    string OtpSessionToken,
    string OtpChannel,
    string MaskedTarget,
    int ResendCooldownSeconds);

public record CompanyVerifyOtpRequest(string OtpSessionToken, string Code);

public record CompanyResendOtpRequest(string OtpSessionToken);

public record CompanyOtpChallengeDto(string OtpChannel, string MaskedTarget, int ResendCooldownSeconds);

public record CompanyRefreshRequest(string RefreshToken);

public record CompanySessionConfigDto(int WebInactivityTimeoutMinutes, int MobileInactivityTimeoutMinutes);

public record CompanyTokenPairDto(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    CompanyDto Company,
    CompanySessionConfigDto SessionConfig,
    bool MustChangePassword);

public record CompanyChangeInitialPasswordRequest(string NewPassword);

public record CompanyChangePasswordRequest(string CurrentPassword, string NewPassword);

public record CompanyForgotPasswordRequest(string Identifier);

public record CompanyForgotPasswordResultDto(string OtpChannel, string MaskedTarget, int ResendCooldownSeconds);

public record CompanyVerifyResetOtpRequest(string Identifier, string OtpCode);

public record CompanyResetPasswordRequest(string Identifier, string OtpCode, string NewPassword);
