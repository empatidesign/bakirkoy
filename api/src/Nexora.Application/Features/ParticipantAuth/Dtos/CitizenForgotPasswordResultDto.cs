namespace Nexora.Application.Features.ParticipantAuth.Dtos;

// RegistrationRequired=true: kayıtta iletişim bilgisi yok; OTP gönderilmedi. İstemci
// kişiyi Registration (NVİ önizleme + çocuklar) ile "Kayıt Ol" adımına yönlendirir,
// telefon ve şifre orada belirlenir. Mevcut kayıt silinmez, aynı Id ile sahiplenilir.
public record CitizenForgotPasswordResultDto(
    string OtpChannel,
    string MaskedTarget,
    int ResendCooldownSeconds,
    bool RegistrationRequired = false,
    CitizenNviLookupResultDto? Registration = null);
