namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityDto(
    Guid Id,
    string Module,
    string Code,
    string Name,
    string Kind,
    Guid? ServiceFacilityId,
    string? ServiceFacilityName,
    string? District,
    string? Address,
    int Capacity,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    int GroupCount,
    int RegisteredCount,
    int TotalGroupCapacity,
    int WaitlistCount,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? DeletedAt = null,
    string? DeletedBy = null,
    IReadOnlyList<string>? Branches = null,
    IReadOnlyList<string>? Genders = null,
    int TodaySessionCount = 0,
    IReadOnlyList<int>? SessionDays = null,
    DateTime? UpdatedAt = null
);

public record FacilityOptionDto(Guid Id, string Name, string Kind, string? District, int Capacity, bool IsActive);

public record FacilitySummaryDto(
    int ActiveFacilities,
    int TotalFacilities,
    int ActiveGroups,
    int CourseCount,
    int AcademyCount,
    int MainParticipants,
    int WaitlistParticipants
);

public record CreateFacilityRequest(
    string Name,
    string Kind,
    Guid? ServiceFacilityId,
    int? Capacity,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    bool IsActive
)
{
    public string? Manager { get; init; }
    public bool GrantAccess { get; init; }
    public string? Tckn { get; init; }
    public string? RoleTemplateKey { get; init; }
    public string? DeliveryChannel { get; init; }
}

public record UpdateFacilityRequest(
    string Name,
    string Kind,
    Guid? ServiceFacilityId,
    int? Capacity,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? ManagerPhone,
    string? ManagerEmail,
    string? EmergencyPhone,
    bool IsActive
)
{
    public string? Manager { get; init; }
    public bool GrantAccess { get; init; }
    public string? Tckn { get; init; }
    public string? RoleTemplateKey { get; init; }
    public string? DeliveryChannel { get; init; }
}
