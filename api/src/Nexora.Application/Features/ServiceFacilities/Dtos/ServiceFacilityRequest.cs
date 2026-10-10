namespace Nexora.Application.Features.ServiceFacilities.Dtos;

public record ServiceFacilityRequest(
    string Name,
    string? Type,
    string? LocationType,
    string? OutdoorCategory,
    int? AreaSizeM2,
    string? Description,
    string? About,
    string? City,
    string? District,
    string? Address,
    double? Latitude,
    double? Longitude,
    Guid? ManagerId,
    string? EmergencyPhone,
    string? Website,
    string? Facebook,
    string? Instagram,
    string? Twitter,
    string WeekdayOpen,
    string WeekdayClose,
    string WeekendOpen,
    string WeekendClose,
    List<string>? Facilities,
    List<string>? AccessibilityFeatures,
    int ParkingCapacity,
    string? ParkingType,
    int? Capacity,
    List<ServiceOfferingDto>? OfferedServices,
    List<FacilityImageDto>? Images)
{
    public string? Manager { get; init; }
    public string? ManagerPhone { get; init; }
    public string? ManagerEmail { get; init; }
    public bool GrantAccess { get; init; }
    public string? Tckn { get; init; }
    public string? RoleTemplateKey { get; init; }
    public string? DeliveryChannel { get; init; }
}
