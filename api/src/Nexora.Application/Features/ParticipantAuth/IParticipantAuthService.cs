using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth;

public interface IParticipantAuthService
{
    Task<CitizenLoginResponseDto> LoginAsync(CitizenLoginRequest request, CancellationToken ct);
    Task<CitizenTokenPairDto> VerifyOtpAsync(CitizenVerifyOtpRequest request, CancellationToken ct);
    Task<CitizenOtpChallengeDto> ResendOtpAsync(CitizenResendOtpRequest request, CancellationToken ct);
    Task<CitizenTokenPairDto> RefreshAsync(CitizenRefreshRequest request, CancellationToken ct);
    Task<CitizenMeResponseDto> GetMeAsync(Guid participantId, CancellationToken ct);
    Task<List<CitizenChildDto>> GetChildrenAsync(Guid participantId, CancellationToken ct);
    Task<CitizenTokenPairDto> SwitchToChildAsync(Guid parentId, Guid childId, CancellationToken ct);
    Task LogoutAsync(Guid participantId, CancellationToken ct);
    Task<CitizenTokenPairDto> ChangeInitialPasswordAsync(Guid participantId, CitizenChangeInitialPasswordRequest request, CancellationToken ct);
    Task ChangePasswordAsync(Guid participantId, CitizenChangePasswordRequest request, CancellationToken ct);
    Task DeleteAccountAsync(Guid participantId, CitizenDeleteAccountRequest request, CancellationToken ct);
    // IDN-11 düzeltmesi (2026-09-01): tek adımlı OTP'siz UpdateContact ucu kaldırıldı.
    // İki adımlı akış: RequestContactChangeAsync yeni değere OTP gönderir,
    // ConfirmContactChangeAsync OTP doğrulanınca değişikliği uygular.
    Task<CitizenOtpChallengeDto> RequestContactChangeAsync(Guid participantId, CitizenRequestContactChangeRequest request, CancellationToken ct);
    Task<CitizenUserDto> ConfirmContactChangeAsync(Guid participantId, CitizenConfirmContactChangeRequest request, CancellationToken ct);
    Task<CitizenUserDto> RefreshFromNviAsync(Guid participantId, CancellationToken ct);
    Task<CitizenUserDto> UploadProfilePhotoAsync(Guid participantId, Stream stream, string fileName, string contentType, CancellationToken ct);

    /// <summary>
    /// Mobil QA bulgusu (2026-09-22, madde 125): fotoğraf yüklenebiliyor ama
    /// kaldırılamıyordu — silme ucu hiç yoktu. Idempotent: fotoğrafı olmayan
    /// kullanıcıda hata fırlatmaz, mevcut kaydı aynen döner.
    /// </summary>
    Task<CitizenUserDto> RemoveProfilePhotoAsync(Guid participantId, CancellationToken ct);
    Task<CitizenForgotPasswordResultDto> ForgotPasswordAsync(CitizenForgotPasswordRequest request, CancellationToken ct);
    Task VerifyResetOtpAsync(CitizenVerifyResetOtpRequest request, CancellationToken ct);
    Task ResetPasswordAsync(CitizenResetPasswordRequest request, CancellationToken ct);
    Task<CitizenNviLookupResultDto> NviLookupAsync(CitizenNviLookupRequest request, CancellationToken ct);
    Task<CitizenLoginResponseDto> RegisterAsync(CitizenRegisterRequest request, CancellationToken ct);
    Task TerminateSessionsAsync(Guid participantId, CancellationToken ct);
    Task<List<CitizenSessionDto>> GetSessionsAsync(Guid participantId, CancellationToken ct);
    Task RevokeSessionAsync(Guid participantId, string sessionId, CancellationToken ct);
    Task<string> GenerateBypassCodeAsync(Guid participantId, CancellationToken ct);
    Task<CitizenBypassTokenDto> ExchangeBypassCodeAsync(string code, CancellationToken ct);
    Task<string> GenerateHandoffCodeAsync(Guid participantId, CancellationToken ct);
    Task<CitizenBypassTokenDto> ExchangeHandoffCodeAsync(string code, CancellationToken ct);

    Task<CitizenFamilyNviPreviewDto> PreviewFamilyFromNviAsync(Guid participantId, CancellationToken ct);
    Task<CitizenFamilyConfirmResultDto> ConfirmFamilyFromNviAsync(Guid participantId, CitizenFamilyConfirmRequest request, CancellationToken ct);

    Task<CitizenUserDto> AcceptKvkkAsync(Guid participantId, CancellationToken ct);
    Task<CitizenUserDto> AcceptNotificationConsentAsync(Guid participantId, CancellationToken ct);
}
