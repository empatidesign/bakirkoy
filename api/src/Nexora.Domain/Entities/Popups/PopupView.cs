using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Popups;

/// <summary>
/// Kullanıcı isteği (2026-09-20): bir vatandaşın bir popup ile son etkileşimi — ne zaman
/// gösterildi, onayladı mı (zorunlu popup'ta "okudum/izledim"), "bir daha gösterme" dedi mi.
/// Tek satır per (PopupCampaignId, ParticipantId) — her gösterimde üzerine yazılır (geçmiş log
/// değil, güncel durum). Tekrar gösterme kararı (RepeatIntervalHours) bu kayıttaki
/// <see cref="LastShownAt"/> üzerinden hesaplanır.
/// </summary>
public class PopupView : BaseEntity
{
    public Guid PopupCampaignId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public DateTime LastShownAt { get; private set; }
    public int ShowCount { get; private set; }
    public DateTime? AcknowledgedAt { get; private set; }
    public bool DismissedForever { get; private set; }

    public static PopupView Create(Guid popupCampaignId, Guid participantId)
        => new()
        {
            PopupCampaignId = popupCampaignId,
            ParticipantId = participantId,
            LastShownAt = DateTime.UtcNow,
            ShowCount = 1,
        };

    public void RecordShown()
    {
        LastShownAt = DateTime.UtcNow;
        ShowCount++;
    }

    public void Acknowledge()
    {
        AcknowledgedAt = DateTime.UtcNow;
    }

    public void DismissForever()
    {
        DismissedForever = true;
    }
}
