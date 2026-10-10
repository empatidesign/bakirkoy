namespace Nexora.Application.Features.Companies.Dtos;

// DiscountUsage'ın admin tarafında /api/v1/discount-usages ile hem listelenebilir hem de
// raporlanabilir olmasına karşılık, aynı "kampanya kullanımı" anlamına gelen CampaignRedemption
// kaydının hiçbir admin-facing liste/rapor ucu yoktu (yalnızca firmanın kendi panelinden
// GetByCompanyIdAsync üzerinden görülebiliyordu). Bu DTO'lar ve aşağıdaki servis/repository/endpoint,
// DiscountUsage tarafındaki yapıyla BİREBİR aynı desende, admin'in QrSystemService.RedeemCampaignAsync
// üzerinden oluşan kampanya kullanımlarını da görüp raporlayabilmesi için ekleniyor
// (bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu — canlı testte doğrulandı:
// GET /discount-usages → 200, GET /campaign-redemptions → 404).
public record CampaignRedemptionDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    Guid? CampaignId,
    string CampaignName,
    Guid ParticipantId,
    string ParticipantName,
    string? ParticipantPhone,
    string RedemptionCode,
    string RedemptionType,
    DateTime RedeemedAt,
    string? Notes,
    bool IsCancelled,
    DateTime? CancelledAt,
    string? CancelReason);

public record CancelRedemptionRequest(string? Reason);

public record CampaignRedemptionSummaryDto(int Total, int UniqueParticipants, int QrScanCount, int DirectScanCount);

public record CampaignRedemptionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? CampaignId { get; init; }
    public string? RedemptionType { get; init; }
    public string? DateRange { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
