namespace Nexora.Application.Features.EmergencyAreas.Dtos;

public record EmergencyEquipmentDto(
    bool Toilet,
    bool Water,
    bool Electricity,
    bool Generator,
    bool Heating,
    bool TentArea);

public record EmergencyAreaDto(
    Guid Id,
    string Name,
    string Neighborhood,
    string Address,
    double? Latitude,
    double? Longitude,
    int Capacity,
    int AreaSizeM2,
    EmergencyEquipmentDto Equipment,
    Guid? ManagerId,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string Manager,
    string ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    string? Description,
    string Status,
    DateTime CreatedAt,
    string? ExternalSource = null,
    long? ExternalId = null,
    DateTime? ExternalSyncedAt = null);
