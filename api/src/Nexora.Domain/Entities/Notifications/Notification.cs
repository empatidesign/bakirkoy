using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Notifications;

public class Notification : BaseEntity
{
    public Guid RecipientId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public string Type { get; private set; } = "system";
    public bool IsRead { get; private set; }
    public DateTime? ReadAt { get; private set; }
    public string? ReferenceType { get; private set; }
    public string? ReferenceId { get; private set; }
    public string? FacilityName { get; private set; }
    public string? SessionInfo { get; private set; }
    public string? StatusInfo { get; private set; }

    // Kullanıcı isteği (2026-09-01): saha anketörlerine gönderilen duyurular
    // "okudum" onayı alınmadan kapatılamamalı. RequiresAck=true olan bildirim
    // uygulamada tam ekran, kapatılamaz bir popup olarak gösterilir; onay
    // verilene kadar tekrar tekrar açılır.
    public bool RequiresAck { get; private set; }
    public DateTime? AcknowledgedAt { get; private set; }
    public bool IsAcknowledged => AcknowledgedAt.HasValue;

    public static Notification Create(
        Guid recipientId, string title, string body, string type,
        string? referenceType = null, string? referenceId = null,
        string? facilityName = null, string? sessionInfo = null, string? statusInfo = null,
        bool requiresAck = false)
        => new()
        {
            RecipientId = recipientId,
            Title = title,
            Body = body,
            Type = string.IsNullOrWhiteSpace(type) ? "system" : type,
            IsRead = false,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            FacilityName = facilityName,
            SessionInfo = sessionInfo,
            StatusInfo = statusInfo,
            RequiresAck = requiresAck,
        };

    public void MarkRead()
    {
        if (IsRead) return;

        IsRead = true;
        ReadAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Kullanıcı "Okudum, anladım" dediğinde çağrılır. Onay okunmayı da kapsar,
    /// aksi hâlde zil rozetinde okunmamış görünmeye devam ederdi.
    /// </summary>
    public void Acknowledge()
    {
        if (AcknowledgedAt.HasValue) return;

        AcknowledgedAt = DateTime.UtcNow;
        UpdatedAt = AcknowledgedAt;
        MarkRead();
    }
}
