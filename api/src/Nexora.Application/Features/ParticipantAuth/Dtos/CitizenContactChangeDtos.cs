namespace Nexora.Application.Features.ParticipantAuth.Dtos;

// IDN-11 düzeltmesi (2026-09-01): Eski tek-adımlı UpdateContact ucu OTP'siz
// doğrudan değişiklik uyguluyordu (hesap ele geçirme riski, docs/SISTEM_TEST_KIMLIK_YETKI_2026-08-26.md).
// Artık iki adımlı akış kullanılıyor: RequestContactChange (yeni değere OTP
// gönderir) ve ConfirmContactChange (OTP doğrulanınca değişikliği uygular).
// Kullanıcı zaten oturum açmış (Citizen auth) olduğu için ekstra bir "pending
// token" gerekmez — OTP, login akışındaki gibi participantId'ye bağlı saklanır.
public record CitizenRequestContactChangeRequest(string? Email, string? Phone, string? CurrentPassword = null);

public record CitizenConfirmContactChangeRequest(string Code);
