namespace Nexora.Application.Common.Interfaces;

// Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): manuel SMS gönderimi
// (admin panelden tetiklenen toplu/bireysel gönderimler) İLK gönderimden itibaren her
// seferinde zorunlu ikinci faktör ister. PIN yöntemi kullanıcı isteğiyle tamamen kaldırıldı
// (2026-09-20, son güncelleme): "pin şifresini kaldırabilirsin sadece sms doğrulaması ile
// gönderilsin" — artık TEK yol, admin'in kendi telefonuna gönderilen tek kullanımlık SMS
// doğrulama kodu (OTP, bkz. IOtpService, OtpPurpose.SmsSendConfirmation,
// POST /api/v1/sms-send/request-otp). Bu servis YALNIZCA admin-tetikli manuel gönderim
// akışlarında (ör. *ManualMessageAsync metodları) kullanılır — sistem otomatik SMS'leri
// (OTP, randevu hatırlatması vb.) bu kontrolden geçmez.
public interface ISmsGovernanceService
{
    /// <summary>
    /// OTP doğruysa hiçbir şey fırlatmaz; aksi halde ConflictException fırlatır:
    /// - Hiç girilmemişse: "SMS_VERIFICATION_REQUIRED"
    /// - Yanlış/süresi dolmuş/çok fazla deneme: IOtpService'in kendi kodu (OTP_MISMATCH,
    ///   OTP_EXPIRED, OTP_TOO_MANY_ATTEMPTS, OTP_LOCKED_OUT) olduğu gibi yeniden fırlatılır.
    /// Bu metod ayrıca sonucu (izin verildi/engellendi) SmsSendLog'a kalıcı olarak yazar.
    /// </summary>
    /// <param name="otpCode">Kullanıcının kendi telefonuna gelen OTP kodu.</param>
    Task EnsureCanSendAsync(string module, string? description, int recipientCount, string? otpCode, CancellationToken ct);
}
