namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenVerifyOtpRequest(
    string OtpSessionToken,
    string Code,
    bool KvkkAccepted = false,
    bool NotificationConsentAccepted = false);
