namespace Nexora.Application.Features.Notifications.Dtos;

public record CitizenNotificationDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsRead,
    DateTime CreatedAt,
    Guid PersonId,
    string PersonName,
    bool IsSelf,
    string? ReferenceType,
    string? ReferenceId,
    string? FacilityName,
    string? SessionInfo,
    string? StatusInfo,
    /// <summary>true ise uygulama bunu kapatılamaz popup olarak gösterir ve onay bekler.</summary>
    bool RequiresAck = false,
    DateTime? AcknowledgedAt = null
);
