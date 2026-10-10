namespace Nexora.Application.Features.Departments.Dtos;

public record DepartmentDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    int AssignedUserCount
);

public record DepartmentOptionDto(Guid Id, string Name);
