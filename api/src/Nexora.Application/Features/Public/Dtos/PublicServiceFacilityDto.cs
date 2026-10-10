namespace Nexora.Application.Features.Public.Dtos;

public record PublicServiceFacilityDto(
    Guid Id,
    string Name,
    string Type,
    string LocationType,
    string? OutdoorCategory,
    int? AreaSizeM2,
    string? Description,
    string? About,
    string? City,
    string? District,
    string? Address,
    double? Latitude,
    double? Longitude,
    string? EmergencyPhone,
    string? Website,
    string? Facebook,
    string? Instagram,
    string? Twitter,
    PublicWorkingHoursDto? WorkingHours,
    IReadOnlyList<string> Facilities,
    IReadOnlyList<string> AccessibilityFeatures,
    int? ParkingCapacity,
    string? ParkingType,
    int? Capacity,
    IReadOnlyList<PublicServiceOfferingDto> Services,
    IReadOnlyList<PublicFacilityImageDto> Images,
    string? PrimaryImageUrl,
    DateTime? UpdatedAt);

public record PublicWorkingHoursDto(
    string? WeekdayOpen,
    string? WeekdayClose,
    string? WeekendOpen,
    string? WeekendClose);

public record PublicServiceOfferingDto(
    string Name,
    string Module,
    string? Description);

public record PublicFacilityImageDto(string Url, string? Name, bool IsPrimary);

public record PublicFacilityMapPointDto(
    Guid Id,
    string Name,
    string Type,
    double Latitude,
    double Longitude,
    string? District,
    string? PrimaryImageUrl);
