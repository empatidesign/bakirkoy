namespace Nexora.Application.Features.Notifications.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-08-11): Quiz/Anket/Çark(Hediye)/Muhtarlık modülleri için paylaşılan
/// şablon DTO'su. Diğer modüllerdeki (Travel/SEDA/Facility/Library/Company) NotificationTemplate
/// DTO'larıyla aynı alan setini taşır — desen tutarlılığı için.
/// </summary>
public record ModuleNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody,
    bool NotifyEnabled,
    string NotifyBody
);

public record ModuleNotificationSettingsDto(
    List<ModuleNotificationTemplateDto>? NotificationTemplates
);

/// <summary>
/// Ortak manuel/toplu mesaj gönderme isteği. Target'lar modüle göre değişir (örn. quiz için
/// "quiz" | "participation" id listesi), TargetKind çağıran servise hangi kaynak tipini
/// resolve edeceğini söyler.
/// </summary>
public record ModuleManualMessageRequest(
    string TargetKind,
    List<Guid> Ids,
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS gönderiminde HER
    // seferinde SMS doğrulama kodu (OTP) zorunlu — bkz. ISmsGovernanceService. Sms=false
    // ise bu alan hiç kullanılmaz. PIN yöntemi kullanıcı isteğiyle kaldırıldı.
    string? SmsOtp = null
);

public record ModuleManualMessageResultDto(
    int Recipients,
    int SmsSent,
    int NotificationsCreated,
    bool SmsMockMode = false
);
