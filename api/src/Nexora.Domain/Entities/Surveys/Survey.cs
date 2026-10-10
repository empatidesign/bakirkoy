using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

public record SurveyData(
    string Title,
    string Description,
    string Category,
    string TargetAudience,
    DateTime? StartDate,
    DateTime? EndDate,
    int EstimatedDuration,
    string Status,
    bool IsActive,
    bool IsAnonymous,
    bool AllowMultipleResponses,
    bool ShowResults,
    bool AutoSendAfterEvent,
    bool SendReminderSMS,
    string? SourceType,
    Guid? SourceId,
    bool IsRequired,
    // --- SultanŞehir Anket Platformu (docs/SultanSehir_Anket_Platformu_MD_Paketi) ---
    // Mevcut çağrıları bozmamak için tümü varsayılan değerli.
    string SurveyType = "standard",
    string IdentityMode = "identified",
    string? Topic = null,
    List<string>? TargetNeighborhoods = null,
    int TargetResponseCount = 0,
    bool FieldEnabled = false,
    bool RequireLocation = false
);

public class Survey : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public string TargetAudience { get; private set; } = "all";
    public DateTime? StartDate { get; private set; }
    public DateTime? EndDate { get; private set; }
    public int EstimatedDuration { get; private set; } = 5;
    public string Status { get; private set; } = "draft";
    public bool IsActive { get; private set; } = true;
    public bool IsAnonymous { get; private set; }
    public bool AllowMultipleResponses { get; private set; }
    public bool ShowResults { get; private set; } = true;
    public bool AutoSendAfterEvent { get; private set; }
    public bool SendReminderSMS { get; private set; }
    public string? SourceType { get; private set; }
    public Guid? SourceId { get; private set; }
    public bool IsRequired { get; private set; }

    // --- SultanŞehir Anket Platformu alanları ---
    /// <summary>standard | dynamic | neighborhood | topic | satisfaction | pulse | anonymous | verified | post_event | internal</summary>
    public string SurveyType { get; private set; } = "standard";
    /// <summary>identified | semi_anonymous | anonymous</summary>
    public string IdentityMode { get; private set; } = "identified";
    /// <summary>Konu etiketi (Temizlik, Ulaşım, Park ve Bahçeler…) — konu bazlı analiz için.</summary>
    public string? Topic { get; private set; }
    /// <summary>Anketin uygulanacağı mahalleler; boş = tüm ilçe.</summary>
    public List<string> TargetNeighborhoods { get; private set; } = [];
    /// <summary>Hedeflenen toplam katılım (0 = hedef yok).</summary>
    public int TargetResponseCount { get; private set; }
    /// <summary>Saha (tablet) uygulamasında anketörlere açık mı.</summary>
    public bool FieldEnabled { get; private set; }
    /// <summary>Saha kaydında GPS konumu zorunlu mu.</summary>
    public bool RequireLocation { get; private set; }

    public int QuestionCount { get; private set; }
    public int TotalResponses { get; private set; }
    public double? AverageRating { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public ICollection<SurveyQuestion> Questions { get; private set; } = [];

    public static Survey Create(SurveyData d, string? actor)
    {
        var survey = new Survey { CreatedBy = actor };
        survey.Apply(d);
        return survey;
    }

    public void Update(SurveyData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(SurveyData d)
    {
        Title = d.Title.Trim();
        Description = d.Description.Trim();
        Category = d.Category.Trim();
        TargetAudience = d.TargetAudience.Trim();
        StartDate = d.StartDate.HasValue ? DateTime.SpecifyKind(d.StartDate.Value, DateTimeKind.Utc) : null;
        EndDate = d.EndDate.HasValue ? DateTime.SpecifyKind(d.EndDate.Value, DateTimeKind.Utc) : null;
        EstimatedDuration = d.EstimatedDuration < 1 ? 1 : d.EstimatedDuration;
        Status = d.Status.Trim();
        IsActive = d.IsActive;
        IsAnonymous = d.IsAnonymous;
        AllowMultipleResponses = d.AllowMultipleResponses;
        ShowResults = d.ShowResults;
        AutoSendAfterEvent = d.AutoSendAfterEvent;
        SendReminderSMS = d.SendReminderSMS;
        SourceType = string.IsNullOrWhiteSpace(d.SourceType) ? null : d.SourceType.Trim();
        SourceId = d.SourceId;
        IsRequired = d.IsRequired;
        SurveyType = string.IsNullOrWhiteSpace(d.SurveyType) ? "standard" : d.SurveyType.Trim();
        IdentityMode = string.IsNullOrWhiteSpace(d.IdentityMode) ? "identified" : d.IdentityMode.Trim();
        Topic = string.IsNullOrWhiteSpace(d.Topic) ? null : d.Topic.Trim();
        TargetNeighborhoods = d.TargetNeighborhoods?.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct().ToList() ?? [];
        TargetResponseCount = d.TargetResponseCount < 0 ? 0 : d.TargetResponseCount;
        FieldEnabled = d.FieldEnabled;
        RequireLocation = d.RequireLocation;

        // Tam anonim kimlik modu, IsAnonymous bayrağıyla tutarlı olmalı: analitik ve
        // yanıt ekranlarındaki kimlik gizleme mevcut kodda IsAnonymous üzerinden çalışıyor.
        if (IdentityMode == "anonymous") IsAnonymous = true;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void SetStatus(string status) => Status = status.Trim();

    public void ReplaceQuestions(IEnumerable<SurveyQuestion> questions)
    {
        Questions.Clear();
        foreach (var q in questions)
            Questions.Add(q);
        QuestionCount = Questions.Count;
    }

    public void SetQuestionCount(int count) => QuestionCount = count < 0 ? 0 : count;
    public void IncrementResponses() => TotalResponses++;
    public void SetTotalResponses(int count) => TotalResponses = count < 0 ? 0 : count;
}
