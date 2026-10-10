namespace Nexora.Application.Features.EmergencyAreas.Dtos;

public record EmergencyAreaRequest(
    string Name,
    string Neighborhood,
    string Address,
    double? Latitude,
    double? Longitude,
    int Capacity,
    int AreaSizeM2,
    EmergencyEquipmentDto? Equipment,
    Guid? ManagerId,
    string? Manager,
    string? ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    string? Description,
    bool GrantAccess = false,
    string? Tckn = null,
    string? RoleTemplateKey = null,
    string? DeliveryChannel = null);
