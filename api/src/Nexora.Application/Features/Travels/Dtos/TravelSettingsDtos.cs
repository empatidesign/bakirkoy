namespace Nexora.Application.Features.Travels.Dtos;

public record TravelGeneralSettingsDto(
    int MaxParticipants,
    int MinAge,
    int MaxAge,
    int AdvanceBookingDays,
    int CancellationDeadlineDays,
    bool RequireApproval,
    bool ReserveListEnabled,
    bool NoShowBlocksNextTravel = false,
    int AttendanceReminderHoursBeforeDeparture = 25,
    bool AutoInviteSmsEnabled = true,
    int InviteSmsDelayMinutes = 5,
    // Kullanıcı isteği (2026-08-29): "sistem ayarlarında bunu sms ve mail içinde
    // yapalım" — kalkış hatırlatması artık SMS'e ek olarak, katılımcının e-postası
    // varsa e-posta ile de gönderilebiliyor (varsayılan kapalı, mevcut davranış
    // değişmesin diye).
    bool AttendanceReminderEmailEnabled = false
);

public record TravelParticipationSettingsDto(string DefaultPeriod, int DefaultLimitCount, bool ApplyToVehicleFreeTravels = true);

public record TravelPaymentSettingsDto(bool RequirePayment, int PaymentDeadlineDays, decimal DepositAmount, string RefundPolicy);

public record TravelRestrictionRuleDto(string Id, string Type, string Description, bool Active);

public record TravelRuleItemDto(string Id, string Title, string Content, bool Active);

/// <summary>
/// Kullanıcı isteği (2026-08-07): Gezi modülündeki tüm mesajlaşma (başvuru alındı, onay,
/// ret, yedek listesi, iptal, yaklaşan gezi hatırlatması) tek bir şablon sistemi altında
/// birleştirildi. Facility/Event modüllerindeki aynı desen (JSON dizi, SMS+bildirim ayrı
/// toggle, {{placeholder}} interpolasyonu). "Manuel" olayı, elle/toplu mesaj gönderme
/// ekranında varsayılan öneri metni olarak kullanılır (zorunlu tetikleyici değildir).
/// </summary>
public record TravelNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody,
    bool NotifyEnabled,
    string NotifyBody
);

public record TravelSettingsDto(
    TravelGeneralSettingsDto General,
    TravelParticipationSettingsDto Participation,
    TravelPaymentSettingsDto Payment,
    List<TravelRestrictionRuleDto> Restrictions,
    List<TravelRuleItemDto> Rules,
    List<TravelNotificationTemplateDto>? NotificationTemplates = null
);
