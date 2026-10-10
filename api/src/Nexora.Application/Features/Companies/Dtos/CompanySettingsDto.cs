namespace Nexora.Application.Features.Companies.Dtos;

public record CompanyNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody
);

public record CompanyNotificationContext(
    string CompanyName,
    string? Password = null
);

public record CompanyManualMessageRequest(
    List<Guid> CompanyIds,
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    string? SmsOtp = null
);

public record CompanyManualMessageResultDto(
    int Recipients,
    int SmsSent,
    int NotificationsCreated,
    bool SmsMockMode = false
);

public record class CompanySettingsDto
{
    public List<CompanyNotificationTemplateDto>? NotificationTemplates { get; init; }
}
