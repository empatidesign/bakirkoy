namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityInstructorDto(
    Guid Id,
    string Module,
    string FullName,
    string? Tckn,
    string? Phone,
    string? Email,
    string? Specialty,
    int GroupCount,
    bool IsActive,
    DateTime CreatedAt
);

public record FacilityInstructorOptionDto(Guid Id, string FullName, string? Specialty);

public record CreateFacilityInstructorRequest(
    string FullName,
    string? Tckn,
    string? Phone,
    string? Email,
    string? Specialty,
    bool IsActive,
    string DeliveryChannel
);

public record UpdateFacilityInstructorRequest(
    string FullName,
    string? Tckn,
    string? Phone,
    string? Email,
    string? Specialty,
    bool IsActive
);
