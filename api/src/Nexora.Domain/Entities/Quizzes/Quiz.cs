using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Quizzes;

public record QuizData(
    Guid CategoryId,
    string Title,
    string Description,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int QuestionCount,
    int PerQuestionTimeLimit,
    int DurationMinutes,
    bool IsActive,
    Guid? AgeGroupId = null,
    Guid? SubCategoryId = null,
    string? EducationLevel = null,
    int PassingScore = 0,
    bool NegativeMarking = false,
    bool RandomizeQuestions = false,
    bool AllowRetry = false,
    int MaxParticipants = 0,
    int PassRights = 0,
    string? ResidencyMode = null
);

public class Quiz : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public Guid? SubCategoryId { get; private set; }
    public Guid? AgeGroupId { get; private set; }
    public string? EducationLevel { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public string Status { get; private set; } = "upcoming";
    public int QuestionCount { get; private set; }
    public int PerQuestionTimeLimit { get; private set; } = 30;
    public int DurationMinutes { get; private set; } = 10;
    public int PassingScore { get; private set; }
    public bool NegativeMarking { get; private set; }
    public bool RandomizeQuestions { get; private set; }
    public bool AllowRetry { get; private set; }
    public int MaxParticipants { get; private set; }
    public int PassRights { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string ResidencyMode { get; private set; } = "anyone";
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public ICollection<QuizQuestion> Questions { get; private set; } = [];

    public static Quiz Create(QuizData d, string? actor)
    {
        var quiz = new Quiz { CreatedBy = actor };
        quiz.Apply(d);
        return quiz;
    }

    public void Update(QuizData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(QuizData d)
    {
        Title = d.Title.Trim();
        Description = d.Description.Trim();
        CategoryId = d.CategoryId;
        SubCategoryId = d.SubCategoryId;
        AgeGroupId = d.AgeGroupId;
        EducationLevel = string.IsNullOrWhiteSpace(d.EducationLevel) ? null : d.EducationLevel.Trim();
        StartDate = DateTime.SpecifyKind(d.StartDate, DateTimeKind.Utc);
        EndDate = DateTime.SpecifyKind(d.EndDate, DateTimeKind.Utc);
        Status = d.Status.Trim();
        QuestionCount = d.QuestionCount < 0 ? 0 : d.QuestionCount;
        PerQuestionTimeLimit = d.PerQuestionTimeLimit < 5 ? 5 : d.PerQuestionTimeLimit;
        DurationMinutes = d.DurationMinutes < 1 ? 1 : d.DurationMinutes;
        PassingScore = d.PassingScore < 0 ? 0 : d.PassingScore;
        NegativeMarking = d.NegativeMarking;
        RandomizeQuestions = d.RandomizeQuestions;
        AllowRetry = d.AllowRetry;
        MaxParticipants = d.MaxParticipants < 0 ? 0 : d.MaxParticipants;
        PassRights = d.PassRights < 0 ? 0 : d.PassRights;
        IsActive = d.IsActive;
        ResidencyMode = Nexora.Domain.Common.EligibilityRules.NormalizeResidencyMode(d.ResidencyMode);
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void ReplaceQuestions(IEnumerable<QuizQuestion> questions)
    {
        Questions.Clear();
        foreach (var q in questions)
            Questions.Add(q);
        QuestionCount = Questions.Count;
    }

    public void SetQuestionCount(int count) => QuestionCount = count < 0 ? 0 : count;

    public void MarkArchived(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
