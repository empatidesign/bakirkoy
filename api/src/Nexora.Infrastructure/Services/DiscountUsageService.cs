using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class DiscountUsageService(IUnitOfWork uow) : IDiscountUsageService
{
    public async Task<PagedResult<DiscountUsageDto>> GetPagedAsync(DiscountUsageListParams p, CancellationToken ct)
    {
        var paged = await uow.DiscountUsages.GetPagedAsync(p, ct);
        return new PagedResult<DiscountUsageDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<DiscountUsageSummaryDto> GetSummaryAsync(DiscountUsageListParams p, CancellationToken ct)
        => await uow.DiscountUsages.GetSummaryAsync(p, ct);

    public async Task<DiscountUsageDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var usage = await uow.DiscountUsages.GetByIdWithDetailsAsync(id, ct)
            ?? throw new NotFoundException("İndirim kullanımı bulunamadı.", "DISCOUNT_USAGE_NOT_FOUND");
        return MapDto(usage);
    }

    // Hata #22: Campaign.DecrementUsage() ve DiscountUsageStatus.Cancelled tanımlıydı ama hiç
    // çağrılmıyordu — yanlışlıkla kullandırılan bir kampanyayı iptal edip hakkı geri verecek
    // endpoint yoktu. Bu metod DiscountUsage'ı Cancelled'a çeker ve ilişkili Campaign.UsageCount'u
    // geri düşürür (yalnızca daha önce Used durumundaysa, tekrar iptalde no-op).
    public async Task<DiscountUsageDto> CancelAsync(Guid id, string? reason, CancellationToken ct)
    {
        var usage = await uow.DiscountUsages.GetByIdWithDetailsAsync(id, ct)
            ?? throw new NotFoundException("İndirim kullanımı bulunamadı.", "DISCOUNT_USAGE_NOT_FOUND");

        if (usage.Status == DiscountUsageStatus.Cancelled)
            throw new ConflictException("Bu kullanım zaten iptal edilmiş.", "DISCOUNT_USAGE_ALREADY_CANCELLED");

        usage.Cancel(reason);
        uow.DiscountUsages.Update(usage);

        if (usage.Campaign is not null)
        {
            usage.Campaign.DecrementUsage();
            uow.Campaigns.Update(usage.Campaign);
        }

        await uow.SaveChangesAsync(ct);

        return MapDto(usage);
    }

    private static DiscountUsageDto MapDto(DiscountUsage u)
        => new(
            u.Id, u.CompanyId, u.Campaign?.Company?.Name ?? "",
            u.CampaignId, u.Campaign?.Name ?? "",
            u.UserId, u.UserName, u.UserPhone, u.DiscountCode,
            u.OrderAmount, u.UsedAt, u.QrScannedAt, u.Status.ToString(),
            u.CancelledAt, u.CancelReason);
}
