using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Wheels;

public class GiftRequest : BaseEntity
{
    public Guid GiftId { get; private set; }
    public string GiftName { get; private set; } = "";
    public int GiftPoints { get; private set; }
    public string CitizenName { get; private set; } = "";
    public string CitizenTc { get; private set; } = "";
    public string CitizenPhone { get; private set; } = "";
    public int OrderNumber { get; private set; }
    public bool IsWinner { get; private set; }
    public string Source { get; private set; } = "application";
    public Guid? ParticipantId { get; private set; }
    public GiftRequestStatus Status { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? RejectedAt { get; private set; }
    public string? RejectedBy { get; private set; }
    public string? RejectReason { get; private set; }
    public DateTime? DeliveredAt { get; private set; }
    public string? DeliveredBy { get; private set; }
    public string? DeliveryNote { get; private set; }

    public static GiftRequest Create(
        Guid giftId, string giftName, int giftPoints,
        string citizenName, string citizenTc, string citizenPhone,
        int orderNumber, bool isWinner, DateTime requestedAt,
        string source = "application", Guid? participantId = null)
        => new()
        {
            GiftId = giftId,
            GiftName = giftName.Trim(),
            GiftPoints = giftPoints,
            CitizenName = citizenName.Trim(),
            CitizenTc = citizenTc.Trim(),
            CitizenPhone = citizenPhone.Trim(),
            OrderNumber = orderNumber,
            IsWinner = isWinner,
            Source = source,
            ParticipantId = participantId,
            Status = GiftRequestStatus.Pending,
            RequestedAt = requestedAt,
        };

    public void Approve(string? by)
    {
        Status = GiftRequestStatus.Approved;
        ApprovedAt = DateTime.UtcNow;
        ApprovedBy = by;
    }

    public void Reject(string? by, string? reason)
    {
        Status = GiftRequestStatus.Rejected;
        RejectedAt = DateTime.UtcNow;
        RejectedBy = by;
        RejectReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    // Onaylanan bir hediye talebinin fiilen elden/kargo ile teslim edildiğini kaydeder.
    // Önceden GiftRequestStatus enum'ında sadece Pending/Approved/Rejected vardı — "Approved"
    // durumu hem "onaylandı, teslimatı bekliyor" hem de "vatandaşa fiilen teslim edildi"
    // anlamına geliyordu ve bu ikisi ayırt edilemiyordu. Hiçbir yerde DeliveredAt/DeliveryNote
    // alanı yoktu (repo geneli grep + gerçek API şema gözlemiyle doğrulandı,
    // bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu). Durum enum'ı geriye dönük uyumluluk
    // için DEĞİŞTİRİLMEDİ (Approved anlamı "onaylandı" olarak kalıyor, DB'de var olan kayıtlar
    // bozulmuyor) — teslimat ayrı bir zaman damgası/alan seti olarak ekleniyor.
    public void MarkDelivered(string? by, string? note)
    {
        if (Status != GiftRequestStatus.Approved)
            throw new InvalidOperationException("Yalnızca onaylanmış talepler teslim edildi olarak işaretlenebilir.");
        DeliveredAt = DateTime.UtcNow;
        DeliveredBy = by;
        DeliveryNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }
}
