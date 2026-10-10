namespace Nexora.Domain.Enums;

public enum OtpPurpose
{
    TwoFactor = 1,
    PasswordReset = 2,
    AccountActivation = 3,
    // IDN-11 düzeltmesi (2026-09-01): telefon/e-posta değişikliği artık OTP ile
    // doğrulanıyor. Bkz. docs/duzeltme_kimlik_otp_2026-09-01.md.
    ContactChange = 4,
    // Kullanıcı isteği (2026-09-19): manuel SMS gönderimleri artık her seferinde ya
    // PIN ya da kendi telefonuna gönderilen bu OTP ile doğrulanmak zorunda — bkz.
    // ISmsGovernanceService.
    SmsSendConfirmation = 5
}
