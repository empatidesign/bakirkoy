namespace Nexora.Application.Features.ServiceFacilities.Dtos;

public record ServiceFacilityOptionDto(
    Guid Id,
    string Name,
    string LocationType);

public record ServiceOfferingDto(
    string Id,
    string? CatalogId,
    string Name,
    string Module,
    string? Description,
    bool Active);

public record FacilityImageDto(
    string Id,
    string Url,
    string? Name,
    long? Size,
    bool IsPrimary);

public record ServiceFacilityDto(
    Guid Id,
    string Name,
    string Type,
    string Status,
    string LocationType,
    string? OutdoorCategory,
    int? AreaSizeM2,
    string? Description,
    string? About,
    string City,
    string District,
    string Address,
    double? Latitude,
    double? Longitude,
    Guid? ManagerId,
    string Manager,
    string ManagerPhone,
    string ManagerEmail,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? EmergencyPhone,
    string? Website,
    string? Facebook,
    string? Instagram,
    string? Twitter,
    string WeekdayOpen,
    string WeekdayClose,
    string WeekendOpen,
    string WeekendClose,
    List<string> Facilities,
    List<string> AccessibilityFeatures,
    int ParkingCapacity,
    string ParkingType,
    int? Capacity,
    List<string> ServiceIds,
    List<ServiceOfferingDto> OfferedServices,
    int ServiceCount,
    List<FacilityImageDto> Images,
    string? PrimaryImageUrl,
    DateTime CreatedAt);

public record MasterQrDto(string? Token, int WindowSeconds, bool Enabled);

public record MasterCardRotateDto(string PlainCode);

public record ToggleMasterQrRequest(bool Enabled);

