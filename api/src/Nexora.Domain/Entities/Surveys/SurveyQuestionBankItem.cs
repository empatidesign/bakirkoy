using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

/// <summary>
/// SultanŞehir Anket Platformu — 02 nolu doküman §7: merkezi soru bankası.
/// Anketlerde tekrar kullanılabilen, konu/birim etiketli hazır sorular.
/// </summary>
public class SurveyQuestionBankItem : BaseEntity
{
    public string Question { get; private set; } = "";
    public string? Description { get; private set; }
    public string Type { get; private set; } = "text";
    public List<string> Options { get; private set; } = [];
    /// <summary>Konu etiketi: Temizlik, Ulaşım, Park ve Bahçeler…</summary>
    public string Topic { get; private set; } = "";
    /// <summary>İlgili belediye birimi/müdürlük (opsiyonel).</summary>
    public string? Unit { get; private set; }
    public int? ScaleMin { get; private set; }
    public int? ScaleMax { get; private set; }
    public string? MinLabel { get; private set; }
    public string? MaxLabel { get; private set; }
    public int? RatingCount { get; private set; }
    public int UsageCount { get; private set; }
    public DateTime? LastUsedAt { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public static SurveyQuestionBankItem Create(
        string question, string? description, string type, List<string>? options,
        string topic, string? unit, int? scaleMin, int? scaleMax,
        string? minLabel, string? maxLabel, int? ratingCount, bool isActive, string? actor)
    {
        var item = new SurveyQuestionBankItem { CreatedBy = actor };
        item.Apply(question, description, type, options, topic, unit, scaleMin, scaleMax, minLabel, maxLabel, ratingCount, isActive);
        return item;
    }

    public void Update(
        string question, string? description, string type, List<string>? options,
        string topic, string? unit, int? scaleMin, int? scaleMax,
        string? minLabel, string? maxLabel, int? ratingCount, bool isActive, string? actor)
    {
        Apply(question, description, type, options, topic, unit, scaleMin, scaleMax, minLabel, maxLabel, ratingCount, isActive);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(
        string question, string? description, string type, List<string>? options,
        string topic, string? unit, int? scaleMin, int? scaleMax,
        string? minLabel, string? maxLabel, int? ratingCount, bool isActive)
    {
        Question = question.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type.Trim();
        Options = options?.Select(o => o.Trim()).Where(o => o.Length > 0).ToList() ?? [];
        Topic = topic.Trim();
        Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        ScaleMin = scaleMin;
        ScaleMax = scaleMax;
        MinLabel = string.IsNullOrWhiteSpace(minLabel) ? null : minLabel.Trim();
        MaxLabel = string.IsNullOrWhiteSpace(maxLabel) ? null : maxLabel.Trim();
        RatingCount = ratingCount;
        IsActive = isActive;
    }

    public void MarkUsed(int times = 1)
    {
        UsageCount += times < 1 ? 1 : times;
        LastUsedAt = DateTime.UtcNow;
    }

    public void Toggle() => IsActive = !IsActive;
}
