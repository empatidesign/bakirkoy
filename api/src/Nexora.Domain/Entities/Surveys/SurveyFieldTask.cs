using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

/// <summary>
/// SultanŞehir Anket Platformu — 03/08 nolu dokümanlar: saha görev atama.
/// Bir anketin belirli bir mahallede, belirli bir anketöre (AdminUser) verilen
/// tarih aralıklı kotalı görevidir. Tablet uygulaması yalnızca kendisine atanmış
/// görevleri görür.
/// </summary>
public class SurveyFieldTask : BaseEntity
{
    public Guid SurveyId { get; private set; }
    /// <summary>Anketör kimliği — InterviewerType'a göre AdminUser.Id ya da Participant.Id.</summary>
    public Guid InterviewerId { get; private set; }
    /// <summary>admin | participant — anketörün sistem yönetici hesabı mı yoksa vatandaş (sistem üyesi) mı olduğu.
    /// Kullanıcı isteği (2026-09-01): saha görevlisi olarak site üyesi vatandaşlar da atanabilsin.</summary>
    public string InterviewerType { get; private set; } = "admin";
    /// <summary>Null ise "tüm mahalleler" — bu görev mahalle kısıtı olmadan uygulanır.</summary>
    public string? Neighborhood { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    /// <summary>Görev süresince hedeflenen toplam anket sayısı.</summary>
    public int TargetCount { get; private set; }
    /// <summary>Günlük hedef (0 = sınırsız).</summary>
    public int DailyTarget { get; private set; }
    /// <summary>assigned | in_progress | completed | cancelled</summary>
    public string Status { get; private set; } = "assigned";
    public string? Note { get; private set; }
    public DateTime? LastSyncAt { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public static SurveyFieldTask Create(
        Guid surveyId, Guid interviewerId, string? neighborhood,
        DateTime startDate, DateTime endDate, int targetCount, int dailyTarget,
        string? note, string? actor, string interviewerType = "admin")
        => new()
        {
            SurveyId = surveyId,
            InterviewerId = interviewerId,
            InterviewerType = string.IsNullOrWhiteSpace(interviewerType) ? "admin" : interviewerType.Trim(),
            Neighborhood = string.IsNullOrWhiteSpace(neighborhood) ? null : neighborhood.Trim(),
            StartDate = DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(endDate, DateTimeKind.Utc),
            TargetCount = targetCount < 0 ? 0 : targetCount,
            DailyTarget = dailyTarget < 0 ? 0 : dailyTarget,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CreatedBy = actor,
        };

    public void Update(
        Guid interviewerId, string? neighborhood, DateTime startDate, DateTime endDate,
        int targetCount, int dailyTarget, string? note, string status, string? actor,
        string interviewerType = "admin")
    {
        InterviewerId = interviewerId;
        InterviewerType = string.IsNullOrWhiteSpace(interviewerType) ? "admin" : interviewerType.Trim();
        Neighborhood = string.IsNullOrWhiteSpace(neighborhood) ? null : neighborhood.Trim();
        StartDate = DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
        EndDate = DateTime.SpecifyKind(endDate, DateTimeKind.Utc);
        TargetCount = targetCount < 0 ? 0 : targetCount;
        DailyTarget = dailyTarget < 0 ? 0 : dailyTarget;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Status = status.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    public void SetStatus(string status, string? actor)
    {
        Status = status.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    /// <summary>Kullanıcı isteği (2026-09-01): toplu "anket ata" işlemi — görevin bağlı
    /// olduğu anketi değiştirir. Toplanan yanıtlar kendi anketlerine bağlı kalır.</summary>
    public void SetSurvey(Guid surveyId, string? actor)
    {
        SurveyId = surveyId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    public void TouchSync() => LastSyncAt = DateTime.UtcNow;
}
