using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Quizzes;

public class QuizParticipation : BaseEntity
{
    public Guid QuizId { get; private set; }
    public string ParticipantName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public int Score { get; private set; }
    public int TotalQuestions { get; private set; }
    public int CorrectAnswers { get; private set; }
    public int WrongAnswers { get; private set; }
    public int TimeSpent { get; private set; }
    public DateTime CompletedAt { get; private set; }
    public string AnswersJson { get; private set; } = "[]";
    public int ParticipantAge { get; private set; }
    public Guid? AgeGroupId { get; private set; }
    public Guid? CategoryId { get; private set; }

    public static QuizParticipation Create(
        Guid quizId, string participantName, string tckn,
        int score, int totalQuestions, int correctAnswers, int timeSpent,
        DateTime completedAt, string answersJson,
        int participantAge = 0, Guid? ageGroupId = null, Guid? categoryId = null,
        int passedCount = 0)
        => new()
        {
            QuizId = quizId,
            ParticipantName = participantName.Trim(),
            Tckn = tckn.Trim(),
            Score = score < 0 ? 0 : score,
            TotalQuestions = totalQuestions < 0 ? 0 : totalQuestions,
            CorrectAnswers = correctAnswers < 0 ? 0 : correctAnswers,
            // DÜZELTME (2026-09-27, KAPSAMLI BİLGİ YARIŞMASI TESTİ — canlı testte kanıtlandı):
            // önceden WrongAnswers = totalQuestions - correctAnswers olarak hesaplanıyordu,
            // PassRights (pas geçme hakkı) ile işaretlenen soruları hiç düşmüyordu. Sonuç: vatandaş
            // tarafına (SubmitLockedAsync'in kendi DTO hesaplaması) doğru "pas geçilen X, yanlış Y"
            // gösteriliyordu ama admin panelde (GetParticipationDetailAsync -> bu entity alanı)
            // pas geçilen sorular "yanlış" sayılıyordu (canlı PoC: 1 pas + 6 doğru + 3 gerçek yanlış
            // bir katılımda vatandaş tarafı doğru şekilde wrongAnswers=3 dönerken admin panel
            // wrongAnswers=4 gösteriyordu — pas geçilen soru sessizce yanlışa eklenmişti).
            WrongAnswers = Math.Max(0, totalQuestions - correctAnswers - passedCount),
            TimeSpent = timeSpent < 0 ? 0 : timeSpent,
            CompletedAt = DateTime.SpecifyKind(completedAt, DateTimeKind.Utc),
            AnswersJson = string.IsNullOrWhiteSpace(answersJson) ? "[]" : answersJson,
            ParticipantAge = participantAge < 0 ? 0 : participantAge,
            AgeGroupId = ageGroupId,
            CategoryId = categoryId,
        };
}
