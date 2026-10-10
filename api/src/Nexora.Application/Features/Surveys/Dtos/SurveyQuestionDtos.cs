namespace Nexora.Application.Features.Surveys.Dtos;

public record SurveyQuestionConfigDto(
    int? ScaleMin,
    int? ScaleMax,
    string? MinLabel,
    string? MaxLabel,
    int? RatingCount
);

public record SurveyQuestionDto(
    Guid Id,
    Guid SurveyId,
    int Order,
    string Type,
    string Question,
    string? Description,
    bool Required,
    List<string> Options,
    SurveyQuestionConfigDto Config
);

public record SurveyQuestionConfigRequest(
    int? ScaleMin,
    int? ScaleMax,
    string? MinLabel,
    string? MaxLabel,
    int? RatingCount
);

public record SurveyQuestionRequest(
    string Type,
    string Question,
    string? Description,
    bool Required,
    List<string> Options,
    SurveyQuestionConfigRequest? Config
);
