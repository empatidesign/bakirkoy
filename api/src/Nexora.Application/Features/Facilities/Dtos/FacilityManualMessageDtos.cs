namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityManualMessageRequest(
    string Module,
    string Target,
    List<Guid> Ids,
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    List<string>? StatusFilter = null,
    string? SmsOtp = null
);

public record FacilityManualMessageResultDto(
    int Recipients,
    int SmsSent,
    int NotificationsCreated,
    bool SmsMockMode = false
);
