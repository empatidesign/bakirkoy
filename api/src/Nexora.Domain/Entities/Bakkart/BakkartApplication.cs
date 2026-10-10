using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Bakkart;

public class BakkartApplication : BaseEntity
{
    public string TrackingNo { get; private set; } = "";
    public Guid? ParticipantId { get; private set; }

    public string EncryptedFullName { get; private set; } = "";
    public string EncryptedTckn { get; private set; } = "";
    public string TcknHash { get; private set; } = "";
    public string TcknLast4 { get; private set; } = "";
    public string EncryptedPhone { get; private set; } = "";
    public string PhoneLast4 { get; private set; } = "";

    public string District { get; private set; } = "";
    public BakkartCardType CardType { get; private set; }
    public BakkartDeliveryType DeliveryType { get; private set; }
    public BakkartApplicationStatus Status { get; private set; }

    public string DocumentsJson { get; private set; } = "[]";
    public DateTime AppliedAt { get; private set; }
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public string? RejectReason { get; private set; }
    public string? Notes { get; private set; }
    public Guid? CardId { get; private set; }

    private BakkartApplication() { }

    public static BakkartApplication Create(
        Guid? participantId,
        string trackingNo,
        string encryptedFullName,
        string encryptedTckn,
        string tcknHash,
        string tcknLast4,
        string encryptedPhone,
        string phoneLast4,
        string district,
        BakkartCardType cardType,
        BakkartDeliveryType deliveryType,
        string documentsJson,
        string? notes)
        => new()
        {
            ParticipantId = participantId,
            TrackingNo = trackingNo,
            EncryptedFullName = encryptedFullName,
            EncryptedTckn = encryptedTckn,
            TcknHash = tcknHash,
            TcknLast4 = tcknLast4,
            EncryptedPhone = encryptedPhone,
            PhoneLast4 = phoneLast4,
            District = district.Trim(),
            CardType = cardType,
            DeliveryType = deliveryType,
            Status = BakkartApplicationStatus.Pending,
            DocumentsJson = string.IsNullOrWhiteSpace(documentsJson) ? "[]" : documentsJson,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            AppliedAt = DateTime.UtcNow,
        };

    public void UpdateDocuments(string documentsJson)
    {
        DocumentsJson = string.IsNullOrWhiteSpace(documentsJson) ? "[]" : documentsJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(string? reviewer, Guid cardId)
    {
        Status = BakkartApplicationStatus.Approved;
        ReviewedBy = reviewer;
        ReviewedAt = DateTime.UtcNow;
        RejectReason = null;
        CardId = cardId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject(string? reason, string? reviewer)
    {
        Status = BakkartApplicationStatus.Rejected;
        RejectReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        ReviewedBy = reviewer;
        ReviewedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status = BakkartApplicationStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }
}
