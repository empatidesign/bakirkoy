namespace Nexora.Application.Features.Seda.Dtos;

public record SedaSettingsDto(
    bool ApplicationsOpen,
    bool RequireApproval,
    bool AutoCloseWhenFull,
    SedaPeriodDto? ActivePeriod,
    List<SedaNotificationTemplateDto>? NotificationTemplates = null
);

public record UpdateSedaSettingsRequest(
    bool? ApplicationsOpen,
    bool? RequireApproval,
    bool? AutoCloseWhenFull,
    List<SedaNotificationTemplateDto>? NotificationTemplates = null
);

/// <summary>
/// SEDA mesaj şablonları. Olaylar: application_received, approved, rejected, cancelled,
/// postponed, emergency, manual. SMS ve uygulama içi bildirim kanalları ayrı yönetilir.
/// </summary>
public record SedaNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody,
    bool NotifyEnabled,
    string NotifyBody
);
