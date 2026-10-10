using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Services;

// DiscountUsageService ile aynı desende — bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu:
// CampaignRedemption kayıtları admin panelde ne listelenebiliyor ne raporlanabiliyordu, sadece
// firmanın kendi panelinden GetByCompanyIdAsync üzerinden görülüyordu.
public class CampaignRedemptionService(IUnitOfWork uow) : ICampaignRedemptionService
{
    public async Task<PagedResult<CampaignRedemptionDto>> GetPagedAsync(CampaignRedemptionListParams p, CancellationToken ct)
    {
        var paged = await uow.CampaignRedemptions.GetPagedAsync(p, ct);
        return new PagedResult<CampaignRedemptionDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CampaignRedemptionSummaryDto> GetSummaryAsync(CampaignRedemptionListParams p, CancellationToken ct)
        => await uow.CampaignRedemptions.GetSummaryAsync(p, ct);

    public async Task<CampaignRedemptionDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var redemption = await uow.CampaignRedemptions.GetByIdWithDetailsAsync(id, ct)
            ?? throw new NotFoundException("Kampanya kullanımı bulunamadı.", "CAMPAIGN_REDEMPTION_NOT_FOUND");
        return MapDto(redemption);
    }

    // Hata #22: yanlışlıkla kullandırılan bir kampanyayı iptal edip hakkı geri verecek endpoint
    // yoktu (DiscountUsageService.CancelAsync ile aynı desen). CampaignRedemption'ın kendi
    // Campaign.UsageCount üzerinde etkisi varsa (CampaignId doluysa) geri düşürülür.
    public async Task<CampaignRedemptionDto> CancelAsync(Guid id, string? reason, CancellationToken ct)
    {
        var redemption = await uow.CampaignRedemptions.GetByIdWithDetailsAsync(id, ct)
            ?? throw new NotFoundException("Kampanya kullanımı bulunamadı.", "CAMPAIGN_REDEMPTION_NOT_FOUND");

        if (redemption.IsCancelled)
            throw new ConflictException("Bu kampanya kullanımı zaten iptal edilmiş.", "CAMPAIGN_REDEMPTION_ALREADY_CANCELLED");

        redemption.Cancel(reason);
        uow.CampaignRedemptions.Update(redemption);

        if (redemption.CampaignId.HasValue && redemption.Campaign is not null)
        {
            redemption.Campaign.DecrementUsage();
            uow.Campaigns.Update(redemption.Campaign);
        }

        await uow.SaveChangesAsync(ct);

        return MapDto(redemption);
    }

    private static CampaignRedemptionDto MapDto(CampaignRedemption r)
        => new(
            r.Id, r.CompanyId, r.Company?.Name ?? "",
            r.CampaignId, r.Campaign?.Name ?? "",
            r.ParticipantId, r.Participant?.FullName ?? "", r.Participant?.Phone,
            r.RedemptionCode, r.RedemptionType.ToString(), r.RedeemedAt, r.Notes,
            r.IsCancelled, r.CancelledAt, r.CancelReason);
}
