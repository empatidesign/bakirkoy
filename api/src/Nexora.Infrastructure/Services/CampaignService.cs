using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;
using System.Text.Json;

namespace Nexora.Infrastructure.Services;

public class CampaignService(IUnitOfWork uow, IAuditService audit) : ICampaignService
{
    private const string Module = "Companies";

    public async Task<PagedResult<CampaignDto>> GetPagedAsync(CampaignListParams p, CancellationToken ct)
    {
        var paged = await uow.Campaigns.GetPagedAsync(p, ct);
        return new PagedResult<CampaignDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CampaignSummaryDto> GetSummaryAsync(CampaignListParams p, CancellationToken ct)
        => await uow.Campaigns.GetSummaryAsync(p, ct);

    public async Task<IReadOnlyList<CampaignOptionDto>> GetOptionsAsync(Guid? companyId, CancellationToken ct)
    {
        var campaigns = await uow.Campaigns.GetOptionsAsync(companyId, ct);
        return campaigns.Select(c => new CampaignOptionDto(c.Id.ToString(), c.Name)).ToList();
    }

    public async Task<CampaignDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");
        return MapDto(campaign);
    }

    public async Task<CampaignDto> CreateAsync(CreateCampaignRequest req, CancellationToken ct)
    {
        if (req.CompanyId == Guid.Empty)
            throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var company = await uow.Companies.GetByIdAsync(req.CompanyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var campaign = Campaign.Create(
            company.Id,
            req.Name,
            ParseDiscountType(req.DiscountType),
            req.DiscountValue,
            req.PerUserLimit,
            req.TotalUsageLimit,
            req.MinOrderAmount,
            req.StartDate,
            req.EndDate,
            ParseCategory(req.Category),
            req.ImageUrl,
            req.Description,
            req.Rules,
            req.KvkkText);

        campaign.SyncProducts(MapProducts(req.Products));

        await uow.Campaigns.AddAsync(campaign, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Admin kampanya oluşturdu: {campaign.Name}",
        }, ct);

        campaign = await uow.Campaigns.GetByIdWithCompanyAsync(campaign.Id, ct) ?? campaign;
        return MapDto(campaign);
    }

    public async Task<CampaignDto> UpdateAsync(Guid id, UpdateCampaignRequest req, CancellationToken ct)
    {
        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        var oldValues = JsonSerializer.Serialize(MapDto(campaign));

        campaign.Update(
            req.Name,
            ParseDiscountType(req.DiscountType),
            req.DiscountValue,
            req.PerUserLimit,
            req.TotalUsageLimit,
            req.MinOrderAmount,
            req.StartDate,
            req.EndDate,
            ParseCategory(req.Category),
            req.ImageUrl,
            req.Description,
            req.Rules,
            req.KvkkText);

        campaign.SyncProducts(MapProducts(req.Products));

        uow.Campaigns.Update(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Kampanya güncellendi: {campaign.Name}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(MapDto(campaign)),
        }, ct);

        return MapDto(campaign);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var campaign = await uow.Campaigns.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        uow.Campaigns.Delete(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Kampanya silindi: {campaign.Name}",
        }, ct);
    }

    public async Task<CampaignDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        campaign.SetStatus(campaign.Status == CampaignStatus.Active ? CampaignStatus.Passive : CampaignStatus.Active);
        uow.Campaigns.Update(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Kampanya durumu değiştirildi: {campaign.Name} → {campaign.Status}",
        }, ct);

        return MapDto(campaign);
    }

    private static CampaignDto MapDto(Campaign c)
        => new(
            c.Id, c.CompanyId, c.Company?.Name ?? "",
            c.Name, MapDiscountType(c.DiscountType), c.DiscountValue,
            c.PerUserLimit, c.TotalUsageLimit, c.MinOrderAmount, c.StartDate, c.EndDate,
            c.UsageCount, c.Status.ToString(), c.Category.ToString(),
            c.IsRedeemable,
            c.TotalUsageLimit.HasValue && c.UsageCount >= c.TotalUsageLimit.Value,
            c.Company?.ServiceCategory is not null ? new ServiceCategoryRefDto(c.Company.ServiceCategory.Id, c.Company.ServiceCategory.Name, c.Company.ServiceCategory.Color) : null,
            c.CreatedAt, c.UpdatedAt, c.ImageUrl, c.Description, c.Rules, c.KvkkText,
            c.Products.OrderBy(p => p.SortOrder).Select(p => new CampaignProductDto(p.Id, p.Name, p.ImageUrl, p.Price, p.SortOrder)).ToList());

    private static IEnumerable<(Guid?, string, string?, decimal?, int)> MapProducts(List<CampaignProductInput>? products)
        => (products ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Name))
            .Select((p, i) => (p.Id, p.Name, p.ImageUrl, p.Price, p.SortOrder > 0 ? p.SortOrder : i));

    private static string MapDiscountType(DiscountType type)
        => type == DiscountType.Percentage ? "percentage" : "fixed";

    private static DiscountType ParseDiscountType(string type)
        => type == "percentage" ? DiscountType.Percentage : DiscountType.Fixed;

    private static CampaignCategory ParseCategory(string? category)
        => Enum.TryParse<CampaignCategory>(category, true, out var c) ? c : CampaignCategory.Other;
}
