namespace Nexora.Application.Features.Public.Dtos;

public record PublicEventDto(
    Guid Id,
    string Code,
    string Name,
    string CategoryName,
    string? CategoryColor,
    string VenueType,
    Guid? FacilityId,
    string? FacilityName,
    Guid? HallId,
    string? HallName,
    PublicEventLocationDto? Location,
    DateTime StartDate,
    DateTime EndDate,
    string? StartTime,
    string? EndTime,
    bool IsSingleDay,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int RegisteredCount,
    int AvailableCapacity,
    bool RegistrationOpen,
    bool IsPaid,
    string? PriceInfo,
    bool SultangaziResidentOnly,
    string? Description,
    string? PrimaryImageUrl,
    int SessionCount);

public record PublicEventLocationDto(string? Name, double? Latitude, double? Longitude);

public record PublicEventSessionDto(
    Guid Id,
    DateTime Date,
    string StartTime,
    string EndTime,
    bool IsCancelled);

public record PublicEventCategoryDto(Guid Id, string Name, string? Color, int EventCount);

public record PublicEventCalendarDayDto(DateTime Date, IReadOnlyList<PublicEventDto> Events);
