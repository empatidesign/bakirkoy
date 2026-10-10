using System.Text.Json;

namespace Nexora.Application.Features.Events.Dtos;

public record EventLocationDto(string Name, double? Latitude, double? Longitude);

public record EventAccessConfigDto(
    bool HasSessions,
    bool HasSeating,
    string ReservationType,
    string RegistrationMode,
    bool AttendanceEnabled,
    string EntryMethod,
    bool QrEnabled,
    string QrType,
    int QrRotationSeconds,
    bool KioskEnabled,
    bool TurnstileEnabled,
    bool PublicLinkEnabled,
    bool PublicLinkRequiresPin,
    List<string> StaffIds,
    IReadOnlyList<EventNotificationTemplateDto>? NotificationTemplates = null,
    int CancellationDeadlineHours = 72,
    bool GeofenceEnabled = false,
    int GeofenceRadiusMeters = 150
);

public record EventDto(
    Guid Id,
    string Code,
    string Name,
    Guid CategoryId,
    string CategoryName,
    string CategoryColor,
    string VenueType,
    Guid? FacilityId,
    string? FacilityName,
    Guid? HallId,
    string? HallName,
    EventLocationDto? Location,
    DateTime StartDate,
    DateTime EndDate,
    string Gender,
    int Capacity,
    int ReserveCapacity,
    int MinAge,
    int MaxAge,
    string ParticipationPeriod,
    int ParticipationLimit,
    string Description,
    string InternalNote,
    JsonElement Images,
    EventAccessConfigDto Access,
    JsonElement Pricing,
    JsonElement Points,
    bool IsActive,
    bool SultangaziResidentOnly,
    string? StartTime,
    string? EndTime,
    int RegisteredCount,
    int ReserveCount,
    int SessionCount,
    DateTime CreatedAt,
    string? CreatedBy,
    DateTime? UpdatedAt,
    string? UpdatedBy,
    DateTime? DeletedAt,
    string? DeletedBy,
    string ResidencyMode,
    DateTime? ApplicationStartDate = null,
    DateTime? ApplicationEndDate = null,
    // TravelDto.Crew ile aynı desen: atanmış sorumlu bilgisi (null = atanmadı).
    JsonElement? Responsible = null
);

public record EventSummaryDto(int Total, int Active, int Passive, int TotalRegistered, int TotalCapacity);

public record EventOptionDto(Guid Id, string Name, DateTime StartDate, DateTime EndDate);

public record EventAuditEntryDto(Guid Id, string Action, DateTime At, string ActorName, string? Note);
