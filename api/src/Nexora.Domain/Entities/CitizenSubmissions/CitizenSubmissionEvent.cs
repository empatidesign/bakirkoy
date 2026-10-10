using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "bilimsel bilgi tüm süreler anlatılacak ... tüm süreci
/// muhtarın da görmesi gerek". Bir başvurunun yaşam döngüsündeki her adım (oluşturma,
/// analiz, incelemeye alma, ilgili müdürlüğe iletme, bilgi/çözüm) burada saklanır ki hem
/// vatandaş hem muhtar aşamalar arası geçen süreleri (SLA) görebilsin.
///
/// Görünürlük: <see cref="VisibleToCitizen"/> başvuru sahibine, <see cref="VisibleToMuhtar"/>
/// mahalle muhtarına gösterilir. Muhtar tarafında ASLA kişi adı/TC/telefon yazılmaz —
/// <see cref="ActorName"/> muhtara gösterilmez, yalnızca <see cref="ActorType"/> (vatandaş /
/// belediye / muhtar / sistem) gösterilir.
/// </summary>
public class CitizenSubmissionEvent : BaseEntity
{
    public Guid SubmissionId { get; private set; }
    public string EventType { get; private set; } = "";
    public string Status { get; private set; } = "";
    public string Title { get; private set; } = "";
    public string? Note { get; private set; }
    public string ActorType { get; private set; } = "system";
    public string? ActorName { get; private set; }
    public Guid? ActorId { get; private set; }
    public DateTime OccurredAt { get; private set; } = DateTime.UtcNow;
    public bool VisibleToCitizen { get; private set; } = true;
    public bool VisibleToMuhtar { get; private set; } = true;

    public static CitizenSubmissionEvent Create(
        Guid submissionId,
        string eventType,
        string status,
        string title,
        string? note = null,
        string actorType = "system",
        string? actorName = null,
        Guid? actorId = null,
        bool visibleToCitizen = true,
        bool visibleToMuhtar = true)
        => new()
        {
            SubmissionId = submissionId,
            EventType = eventType,
            Status = status,
            Title = title.Trim(),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            ActorType = actorType,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim(),
            ActorId = actorId,
            OccurredAt = DateTime.UtcNow,
            VisibleToCitizen = visibleToCitizen,
            VisibleToMuhtar = visibleToMuhtar,
        };
}
