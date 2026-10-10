using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

public class SurveyQuestion : BaseEntity
{
    public Guid SurveyId { get; private set; }
    public int Order { get; private set; }
    public string Type { get; private set; } = "text";
    public string Question { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool Required { get; private set; } = true;
    public List<string> Options { get; private set; } = [];
    public int? ScaleMin { get; private set; }
    public int? ScaleMax { get; private set; }
    public string? MinLabel { get; private set; }
    public string? MaxLabel { get; private set; }
    public int? RatingCount { get; private set; }

    public static SurveyQuestion Create(
        Guid surveyId, int order, string type, string question, string? description, bool required,
        List<string>? options, int? scaleMin, int? scaleMax, string? minLabel, string? maxLabel, int? ratingCount)
        => new()
        {
            SurveyId = surveyId,
            Order = order,
            Type = type.Trim(),
            Question = question.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Required = required,
            Options = options?.Select(o => o.Trim()).Where(o => o.Length > 0).ToList() ?? [],
            ScaleMin = scaleMin,
            ScaleMax = scaleMax,
            MinLabel = string.IsNullOrWhiteSpace(minLabel) ? null : minLabel.Trim(),
            MaxLabel = string.IsNullOrWhiteSpace(maxLabel) ? null : maxLabel.Trim(),
            RatingCount = ratingCount,
        };
}
