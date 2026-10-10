using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

/// <summary>
/// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek,
/// GPS açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
///
/// Saha görevlisinin (Participant anketör) tablet/telefonundan periyodik gönderilen konum
/// izidir. Yalnızca aktif bir saha görevi varken toplanır (KVKK: mesai/görev dışı izleme
/// yapılmaz) ve tek başına kişisel içerik taşımaz.
///
/// Tasarım notu: mesafe (yürünen yol) sunucuda ardışık ping'ler arasındaki haversine
/// toplamıyla hesaplanır; cihazın bildirdiği mesafeye güvenilmez.
/// </summary>
public class SurveyFieldLocationPing : BaseEntity
{
    /// <summary>Anketör — Participant.Id (saha görevlisi vatandaş).</summary>
    public Guid InterviewerId { get; private set; }
    /// <summary>Ping anında açık olan saha görevi (biliniyorsa).</summary>
    public Guid? FieldTaskId { get; private set; }
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    /// <summary>Cihazın bildirdiği konum hassasiyeti (metre).</summary>
    public double? AccuracyMeters { get; private set; }
    /// <summary>Cihazın bildirdiği anlık hız (m/sn) — varsa.</summary>
    public double? SpeedMps { get; private set; }
    /// <summary>Konumun cihazda üretildiği an (UTC).</summary>
    public DateTime RecordedAt { get; private set; }
    /// <summary>Bir önceki ping'e göre sunucuda hesaplanan mesafe (metre).</summary>
    public double DistanceFromPreviousMeters { get; private set; }

    public static SurveyFieldLocationPing Create(
        Guid interviewerId, Guid? fieldTaskId, double latitude, double longitude,
        double? accuracyMeters, double? speedMps, DateTime? recordedAtUtc, double distanceFromPreviousMeters)
        => new()
        {
            InterviewerId = interviewerId,
            FieldTaskId = fieldTaskId,
            Latitude = latitude,
            Longitude = longitude,
            AccuracyMeters = accuracyMeters,
            SpeedMps = speedMps,
            RecordedAt = recordedAtUtc.HasValue
                ? DateTime.SpecifyKind(recordedAtUtc.Value, DateTimeKind.Utc)
                : DateTime.UtcNow,
            DistanceFromPreviousMeters = distanceFromPreviousMeters,
        };
}
