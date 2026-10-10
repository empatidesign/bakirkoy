using Nexora.Domain.Enums;

namespace Nexora.Application.Features.Education.Requests;

public record CreateEducationInstitutionRequest(
    InstitutionType Type,
    string Name,
    string? Faculty,
    string? Department,
    DegreeLevel? DegreeLevel
);

public record UpdateEducationInstitutionRequest(
    InstitutionType Type,
    string Name,
    string? Faculty,
    string? Department,
    DegreeLevel? DegreeLevel
);

public record CreateEducationHistoryRequest(
    Guid? InstitutionId,
    EducationLevel Level,
    int StartYear,
    int? EndYear,
    bool IsGraduated
);

public record UpdateEducationHistoryRequest(
    Guid? InstitutionId,
    EducationLevel Level,
    int StartYear,
    int? EndYear,
    bool IsGraduated
);
