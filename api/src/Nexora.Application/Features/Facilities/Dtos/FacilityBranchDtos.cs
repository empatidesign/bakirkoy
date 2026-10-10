namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityBranchDto(
    Guid Id,
    string Module,
    string Name,
    string Description,
    int PeriodMonths,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    int GroupCount,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? DeletedAt = null,
    string? DeletedBy = null,
    int SessionCount = 0,
    int ApplicationCount = 0,
    string Category = ""
);

public record FacilityBranchOptionDto(
    Guid Id,
    string Name,
    int PeriodMonths,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    string Category = ""
);

public record CreateFacilityBranchRequest(
    string Name,
    string Description,
    int PeriodMonths,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    bool IsActive,
    string? Category = null
);

public record UpdateFacilityBranchRequest(
    string Name,
    string Description,
    int PeriodMonths,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    bool IsActive,
    string? Category = null
);

public record BulkUpdateBranchCategoryRequest(
    IReadOnlyList<Guid> Ids,
    string? Category = null
);
