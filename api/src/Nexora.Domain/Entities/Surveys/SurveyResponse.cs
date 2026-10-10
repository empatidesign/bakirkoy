using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

public class SurveyResponse : BaseEntity
{
    public Guid SurveyId { get; private set; }
    public string CitizenTc { get; private set; } = string.Empty;
    public Guid? ParticipantId { get; private set; }
    public string AnswersJson { get; private set; } = string.Empty;
    public DateTime SubmittedAt { get; private set; }

    // --- SultanŞehir Anket Platformu: saha/demografi meta verisi ---
    // Doküman 03/04: mahalle, anketör, cihaz, konum, süre ve demografi kırılımları
    // rapor/kota hesaplarının temelidir. Kişisel veri (TC/ad) burada tutulmaz.
    /// <summary>app | field | web | call_center</summary>
    public string Channel { get; private set; } = "app";
    public string? Neighborhood { get; private set; }
    /// <summary>Saha kaydını yapan anketör (AdminUser.Id veya Participant.Id — InterviewerType'a bakılır).</summary>
    public Guid? InterviewerId { get; private set; }
    /// <summary>admin | participant.</summary>
    public string? InterviewerType { get; private set; }
    public Guid? FieldTaskId { get; private set; }
    public string? DeviceId { get; private set; }
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    /// <summary>Görüşme süresi (saniye) — kalite kontrolde "çok hızlı" tespiti için.</summary>
    public int? DurationSeconds { get; private set; }
    /// <summary>0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+</summary>
    public string? AgeGroup { get; private set; }
    /// <summary>male | female | other</summary>
    public string? Gender { get; private set; }
    /// <summary>Kalite kontrol kuyruğuna alındı mı (doküman 01 §9).</summary>
    public bool IsFlagged { get; private set; }
    public string? FlagReason { get; private set; }
    /// <summary>Offline tablet senkronunda idempotency anahtarı (doküman 06 §5).</summary>
    public string? LocalUuid { get; private set; }

    public static SurveyResponse Create(Guid surveyId, string citizenTc, Guid? participantId, string answersJson)
        => new()
        {
            SurveyId = surveyId,
            CitizenTc = citizenTc.Trim(),
            ParticipantId = participantId,
            AnswersJson = answersJson,
            SubmittedAt = DateTime.UtcNow,
        };

    /// <summary>Saha (tablet) kaydı — anketör, mahalle, konum ve demografi ile birlikte.</summary>
    public static SurveyResponse CreateFieldResponse(
        Guid surveyId, string citizenTc, Guid? participantId, string answersJson,
        Guid? interviewerId, Guid? fieldTaskId, string? neighborhood, string? deviceId,
        double? latitude, double? longitude, int? durationSeconds,
        string? ageGroup, string? gender, string? localUuid, string channel = "field",
        string? interviewerType = null)
    {
        var r = Create(surveyId, citizenTc, participantId, answersJson);
        r.Channel = string.IsNullOrWhiteSpace(channel) ? "field" : channel.Trim();
        r.InterviewerId = interviewerId;
        r.InterviewerType = Trimmed(interviewerType) ?? (interviewerId.HasValue ? "admin" : null);
        r.FieldTaskId = fieldTaskId;
        r.Neighborhood = Trimmed(neighborhood);
        r.DeviceId = Trimmed(deviceId);
        r.Latitude = latitude;
        r.Longitude = longitude;
        r.DurationSeconds = durationSeconds;
        r.AgeGroup = Trimmed(ageGroup);
        r.Gender = Trimmed(gender);
        r.LocalUuid = Trimmed(localUuid);
        return r;
    }

    /// <summary>Vatandaş uygulamasından gelen kayıtta demografiyi profilden zenginleştirir.</summary>
    public void EnrichDemographics(string? neighborhood, string? ageGroup, string? gender)
    {
        Neighborhood ??= Trimmed(neighborhood);
        AgeGroup ??= Trimmed(ageGroup);
        Gender ??= Trimmed(gender);
    }

    public void Flag(string reason)
    {
        IsFlagged = true;
        FlagReason = reason.Trim();
    }

    public void Unflag()
    {
        IsFlagged = false;
        FlagReason = null;
    }

    private static string? Trimmed(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
