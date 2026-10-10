using Nexora.Application.Features.Auth.Dtos;

namespace Nexora.Application.Features.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<ResendOtpResponse> ResendOtpAsync(ResendOtpRequest request, CancellationToken ct);
    Task<TokenPairDto> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken ct);
    Task<TokenPairDto> RefreshAsync(RefreshRequest request, CancellationToken ct);
    Task<AdminMeResponseDto> GetMeAsync(Guid userId, CancellationToken ct);
    Task LogoutAsync(Guid userId, CancellationToken ct);
    Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct);
    Task VerifyResetOtpAsync(AdminVerifyResetOtpRequest request, CancellationToken ct);
    Task ResetPasswordAsync(AdminResetPasswordRequest request, CancellationToken ct);
    Task ChangeInitialPasswordAsync(Guid userId, ChangeInitialPasswordRequest request, CancellationToken ct);
    Task TerminateSessionsAsync(Guid userId, CancellationToken ct);
    Task<MeDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct);

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): "muhtar yönetimi sayfasında ... bypass ederek girsin" —
    /// üst yönetici bir muhtarın (scope'lu AdminUser) panelini kendi hesabıyla, şifresini
    /// bilmeden birebir açabilsin. Katılımcı/firma bypass akışıyla aynı desen: kısa ömürlü
    /// tek kullanımlık kod → citizen-portal değil admin-panel'in kendi /bypass rotasında
    /// değişim (exchange) yapılır.
    /// </summary>
    Task<string> GenerateBypassCodeAsync(Guid targetAdminUserId, CancellationToken ct);
    Task<TokenPairDto> ExchangeBypassCodeAsync(string code, CancellationToken ct);
}
