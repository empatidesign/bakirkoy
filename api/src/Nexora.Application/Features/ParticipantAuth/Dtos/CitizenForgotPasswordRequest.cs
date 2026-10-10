namespace Nexora.Application.Features.ParticipantAuth.Dtos;

// BirthDate: yalnız telefonu/e-postası olmayan kayıtlarda istenir (BIRTHDATE_REQUIRED).
// Bu durumda OTP gönderilemediği için kişi NVİ doğrulamasıyla kayıt akışına alınır.
public record CitizenForgotPasswordRequest(string Identifier, DateTime? BirthDate = null);
