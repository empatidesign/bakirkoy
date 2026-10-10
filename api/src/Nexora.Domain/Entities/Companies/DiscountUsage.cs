using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Companies;

public class DiscountUsage : BaseEntity
{
    public Guid CompanyId { get; private set; }
    public Guid CampaignId { get; private set; }
    public Guid UserId { get; private set; }
    public string UserName { get; private set; } = "";
    public string? UserPhone { get; private set; }
    public string DiscountCode { get; private set; } = "";
    public decimal? OrderAmount { get; private set; }
    public DateTime UsedAt { get; private set; }
    public DateTime? QrScannedAt { get; private set; }
    public DiscountUsageStatus Status { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    public Campaign? Campaign { get; private set; }

    public static DiscountUsage Create(Guid companyId, Guid campaignId, Guid userId, string userName,
        string? userPhone, string discountCode, decimal? orderAmount, DateTime? qrScannedAt)
        => new()
        {
            CompanyId = companyId,
            CampaignId = campaignId,
            UserId = userId,
            UserName = userName.Trim(),
            UserPhone = string.IsNullOrWhiteSpace(userPhone) ? null : userPhone.Trim(),
            DiscountCode = discountCode,
            OrderAmount = orderAmount,
            UsedAt = DateTime.UtcNow,
            QrScannedAt = qrScannedAt,
            Status = DiscountUsageStatus.Used,
        };

    public void Cancel(string? reason)
    {
        if (Status == DiscountUsageStatus.Cancelled) return;
        Status = DiscountUsageStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }
}
