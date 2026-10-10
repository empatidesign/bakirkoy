using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Enums;

namespace Nexora.Application.Features.Education.Dtos;

public record EducationInstitutionDto(
    Guid Id,
    InstitutionType Type,
    string TypeLabel,
    string Name,
    string? Faculty,
    string? Department,
    DegreeLevel? DegreeLevel,
    string? DegreeLevelLabel,
    bool IsActive,
    DateTime CreatedAt
);

public record EducationInstitutionOptionDto(
    Guid Id,
    string Name,
    string? Faculty,
    string? Department,
    InstitutionType Type,
    string TypeLabel
);

public record EducationHistoryDto(
    Guid Id,
    Guid ParticipantId,
    Guid? InstitutionId,
    string? InstitutionName,
    string? Faculty,
    string? Department,
    EducationLevel Level,
    string LevelLabel,
    int StartYear,
    int? EndYear,
    bool IsGraduated,
    DateTime CreatedAt
);

public record EducationInstitutionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public InstitutionType? Type { get; init; }
    public string? Name { get; init; }
    public string? Faculty { get; init; }
    public string? Department { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
