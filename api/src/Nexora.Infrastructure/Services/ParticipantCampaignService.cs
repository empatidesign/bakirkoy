using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.ParticipantCampaigns;
using Nexora.Application.Features.ParticipantCampaigns.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantCampaignService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IQrTokenService qrTokenService,
    IConfiguration config) : IParticipantCampaignService
{
    private int RotationSeconds => config.GetValue("QrSettings:RotationSeconds", 60);
    private int LastDayThresholdDays => config.GetValue("Campaign:LastDayThresholdDays", 1);
    private int NewBadgeDays => config.GetValue("Campaign:NewBadgeDays", 7);
    private static DateTime LocalToday => TurkeyTime.TodayDate();

    public async Task<PagedResult<CitizenCampaignDto>> GetListAsync(CitizenCampaignListParams p, CancellationToken ct)
    {
        var today = LocalToday;
        var thresholdDate = today.AddDays(LastDayThresholdDays);
        var all = await uow.Campaigns.GetVisibleWithCompanyAsync(ct);

        var filtered = all
            .Where(c => c.Status == CampaignStatus.Active || c.Status == CampaignStatus.Completed)
            .AsQueryable();

        filtered = p.DateStatus?.ToLowerInvariant() switch
        {
            "upcoming" => filtered.Where(c => c.StartDate.Date > today),
            "lastdays" => filtered.Where(c => c.StartDate.Date <= today && c.EndDate.Date >= today && c.EndDate.Date <= thresholdDate),
            "active" => filtered.Where(c => c.StartDate.Date <= today && c.EndDate.Date >= today),
            _ => filtered.Where(c => c.EndDate.Date >= today),
        };

        if (!string.IsNullOrWhiteSpace(p.Search))
            filtered = filtered.Where(c => c.Name.Contains(p.Search, StringComparison.OrdinalIgnoreCase)
                || (c.Company != null && c.Company.Name.Contains(p.Search, StringComparison.OrdinalIgnoreCase)));

        if (p.CategoryIds is { Count: > 0 })
            filtered = filtered.Where(c => c.Company != null && c.Company.ServiceCategoryId.HasValue && p.CategoryIds.Contains(c.Company.ServiceCategoryId.Value));

        if (p.CompanyId.HasValue)
            filtered = filtered.Where(c => c.CompanyId == p.CompanyId.Value);

        var newSince = DateTime.UtcNow.AddDays(-NewBadgeDays);
        if (p.OnlyNew)
            filtered = filtered.Where(c => c.CreatedAt >= newSince);

        HashSet<Guid> savedIds = [];
        if (currentUser.Id.HasValue)
            savedIds = await uow.CampaignBookmarks.GetBookmarkedCampaignIdsAsync(currentUser.Id.Value, ct);

        if (p.OnlySaved)
            filtered = filtered.Where(c => savedIds.Contains(c.Id));

        var filteredList = filtered.ToList();

        Dictionary<Guid, int> usageCounts = [];
        if (currentUser.Id.HasValue)
            usageCounts = await uow.DiscountUsages.GetUserUsageCountsByCampaignsAsync(
                currentUser.Id.Value, filteredList.Select(c => c.Id), ct);

        var sorted = string.Equals(p.SortBy, "distance", StringComparison.OrdinalIgnoreCase) && p.Latitude.HasValue && p.Longitude.HasValue
            ? filteredList
                .OrderBy(c => DistanceKmOrNull(p.Latitude, p.Longitude, c.Company?.Latitude, c.Company?.Longitude) ?? double.MaxValue)
                .ToList()
            : string.Equals(p.SortBy, "newest", StringComparison.OrdinalIgnoreCase)
            ? filteredList.OrderByDescending(c => c.CreatedAt).ToList()
            : filteredList
                .Select(c =>
                {
                    var exhausted = c.Status == CampaignStatus.Completed
                        || (c.TotalUsageLimit.HasValue && c.UsageCount >= c.TotalUsageLimit.Value);
                    var fullyUsed = usageCounts.GetValueOrDefault(c.Id, 0) >= c.PerUserLimit;
                    var group = (!exhausted && !fullyUsed) ? 0 : exhausted ? 1 : 2;
                    return (Campaign: c, Group: group);
                })
                .OrderBy(x => x.Group)
                .ThenBy(x => x.Group == 0 ? x.Campaign.EndDate : DateTime.MaxValue)
                .Select(x => x.Campaign)
                .ToList();

        var total = sorted.Count;
        var page = sorted.Skip((p.PageResolved - 1) * p.LimitResolved).Take(p.LimitResolved).ToList();

        var items = page.Select(c => ToDto(c, usageCounts.GetValueOrDefault(c.Id, 0), savedIds.Contains(c.Id), c.CreatedAt >= newSince,
            DistanceKmOrNull(p.Latitude, p.Longitude, c.Company?.Latitude, c.Company?.Longitude))).ToList();

        return new PagedResult<CitizenCampaignDto>
        {
            Items = items,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<CitizenCampaignDto> GetDetailAsync(Guid id, CancellationToken ct)
    {
        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        var today = LocalToday;
        if ((campaign.Status != CampaignStatus.Active && campaign.Status != CampaignStatus.Completed)
            || campaign.EndDate.Date < today
            || campaign.Company is not { Status: CompanyStatus.Approved })
            throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        var myUsageCount = currentUser.Id.HasValue
            ? await uow.DiscountUsages.CountUserUsageAsync(campaign.Id, currentUser.Id.Value, ct)
            : 0;

        var isSaved = currentUser.Id.HasValue
            && await uow.CampaignBookmarks.ExistsAsync(currentUser.Id.Value, campaign.Id, ct);

        return ToDto(campaign, myUsageCount, isSaved);
    }

    public async Task<CitizenCampaignRedeemDto> RedeemAsync(Guid id, CancellationToken ct)
    {
        var citizenId = currentUser.Id
            ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(id, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        if (campaign.Company is not { Status: CompanyStatus.Approved })
            throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        if (!campaign.IsRedeemableOn(LocalToday))
            throw new ConflictException("Bu kampanya artık geçerli değil.", "CAMPAIGN_NOT_REDEEMABLE");

        var usedCount = await uow.DiscountUsages.CountUserUsageAsync(campaign.Id, citizenId, ct)
            + await uow.CampaignRedemptions.CountByParticipantAndCampaignAsync(citizenId, campaign.Id, ct);
        if (usedCount >= campaign.PerUserLimit)
            throw new ConflictException("Bu kampanya için kullanım hakkınız doldu.", "CAMPAIGN_LIMIT_REACHED");

        var token = qrTokenService.Generate(citizenId, $"campaign:{campaign.Id}", RotationSeconds);

        return new CitizenCampaignRedeemDto(
            campaign.Id,
            campaign.Name,
            campaign.Company?.Name ?? "",
            token,
            RotationSeconds,
            campaign.PerUserLimit,
            Math.Max(0, campaign.PerUserLimit - usedCount));
    }

    public async Task<List<CitizenCampaignUsageDto>> GetMyUsagesAsync(CancellationToken ct)
    {
        var citizenId = currentUser.Id
            ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

        var usages = await uow.DiscountUsages.GetUserUsagesAsync(citizenId, ct);

        return usages
            .Where(u => u.Campaign != null)
            .Select(u => new CitizenCampaignUsageDto(
                u.Id,
                u.CampaignId,
                u.Campaign!.Name,
                u.Campaign.Company?.Name ?? "",
                u.Campaign.Company?.Logo,
                u.Campaign.DiscountType.ToString(),
                u.Campaign.DiscountValue,
                u.UsedAt))
            .ToList();
    }

    public async Task<List<ServiceCategoryRefDto>> GetCategoriesAsync(CancellationToken ct)
    {
        var today = LocalToday;
        var all = await uow.Campaigns.GetActiveWithCompanyAsync(ct);

        return all
            .Where(c => c.Status == CampaignStatus.Active && c.StartDate.Date <= today && c.EndDate.Date >= today && c.Company?.ServiceCategory != null)
            .Select(c => c.Company!.ServiceCategory!)
            .Where(sc => sc.IsActive)
            .DistinctBy(sc => sc.Id)
            .OrderBy(sc => sc.Name)
            .Select(sc => new ServiceCategoryRefDto(sc.Id, sc.Name, sc.Color))
            .ToList();
    }

    public Task<CampaignSettingsDto> GetSettingsAsync(CancellationToken ct)
        => Task.FromResult(new CampaignSettingsDto(LastDayThresholdDays));

    public async Task<CitizenCampaignCompanyDto> GetCompanyAsync(Guid companyId, CancellationToken ct)
    {
        var all = await uow.Campaigns.GetVisibleWithCompanyAsync(ct);

        var companyCampaigns = all.Where(c => c.CompanyId == companyId).ToList();
        var company = companyCampaigns.Select(c => c.Company).FirstOrDefault(c => c is not null)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var activeCount = companyCampaigns.Count;

        return new CitizenCampaignCompanyDto(
            company.Id,
            company.Name,
            company.Logo,
            company.Description,
            company.Address,
            company.Phone,
            company.ServiceCategory is not null
                ? new ServiceCategoryRefDto(company.ServiceCategory.Id, company.ServiceCategory.Name, company.ServiceCategory.Color)
                : null,
            activeCount);
    }

    public async Task<PagedResult<CitizenDirectoryCompanyDto>> GetDirectoryAsync(CitizenDirectoryCompanyListParams p, CancellationToken ct)
    {
        var paged = await uow.Companies.GetApprovedDirectoryPagedAsync(p, ct);

        var activeCounts = await uow.Campaigns.CountVisibleByCompaniesAsync(paged.Items.Select(c => c.Id), ct);

        var items = paged.Items.Select(c => new CitizenDirectoryCompanyDto(
            c.Id,
            c.Name,
            c.Logo,
            c.BannerImage,
            c.BannerImageMobile,
            c.Description,
            c.ServiceDescription,
            c.Address,
            c.District,
            c.Phone,
            c.Website,
            c.Latitude,
            c.Longitude,
            c.GalleryImages,
            c.ServiceCategory is not null
                ? new ServiceCategoryRefDto(c.ServiceCategory.Id, c.ServiceCategory.Name, c.ServiceCategory.Color)
                : null,
            activeCounts.GetValueOrDefault(c.Id, 0),
            MapSocialDto(c.SocialMedia),
            DistanceKmOrNull(p.Latitude, p.Longitude, c.Latitude, c.Longitude),
            c.GooglePlaceId)).ToList();

        return new PagedResult<CitizenDirectoryCompanyDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public Task<List<string>> GetDirectoryDistrictsAsync(CancellationToken ct)
        => uow.Companies.GetApprovedDistrictsAsync(ct);

    public async Task<CitizenDirectoryCompanyDto> GetDirectoryCompanyAsync(Guid companyId, double? latitude, double? longitude, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(companyId, ct);
        if (company is null || company.Status != CompanyStatus.Approved)
            throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var visibleCounts = await uow.Campaigns.CountVisibleByCompaniesAsync([company.Id], ct);
        var activeCount = visibleCounts.GetValueOrDefault(company.Id, 0);

        return new CitizenDirectoryCompanyDto(
            company.Id,
            company.Name,
            company.Logo,
            company.BannerImage,
            company.BannerImageMobile,
            company.Description,
            company.ServiceDescription,
            company.Address,
            company.District,
            company.Phone,
            company.Website,
            company.Latitude,
            company.Longitude,
            company.GalleryImages,
            company.ServiceCategory is not null
                ? new ServiceCategoryRefDto(company.ServiceCategory.Id, company.ServiceCategory.Name, company.ServiceCategory.Color)
                : null,
            activeCount,
            MapSocialDto(company.SocialMedia),
            DistanceKmOrNull(latitude, longitude, company.Latitude, company.Longitude),
            company.GooglePlaceId);
    }

    private static double? DistanceKmOrNull(double? userLat, double? userLng, double? companyLat, double? companyLng)
    {
        if (!userLat.HasValue || !userLng.HasValue || !companyLat.HasValue || !companyLng.HasValue)
            return null;
        var meters = GeoDistance.HaversineMeters(userLat.Value, userLng.Value, companyLat.Value, companyLng.Value);
        return Math.Round(meters / 1000.0, 2);
    }

    private static CompanySocialMediaDto? MapSocialDto(CompanySocialMedia? social)
        => social is null ? null : new CompanySocialMediaDto(social.Facebook, social.Instagram, social.Twitter, social.Linkedin);

    public async Task SetBookmarkAsync(Guid campaignId, bool saved, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "UNAUTHORIZED");

        var campaign = await uow.Campaigns.GetByIdAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        var existing = await uow.CampaignBookmarks.GetIncludingDeletedAsync(participantId, campaign.Id, ct);

        if (saved)
        {
            if (existing is null)
            {
                await uow.CampaignBookmarks.AddAsync(CampaignBookmark.Create(participantId, campaign.Id), ct);
            }
            else if (existing.IsDeleted)
            {
                existing.IsDeleted = false;
                existing.DeletedAt = null;
                uow.CampaignBookmarks.Update(existing);
            }
            else
            {
                return;
            }
        }
        else
        {
            if (existing is null || existing.IsDeleted)
                return;
            uow.CampaignBookmarks.Delete(existing);
        }

        await uow.SaveChangesAsync(ct);
    }

    private static CitizenCampaignDto ToDto(Campaign c, int myUsageCount = 0, bool isSaved = false, bool isNew = false, double? distanceKm = null) => new(
        c.Id,
        c.CompanyId,
        c.Company?.Name ?? "",
        c.Company?.Logo,
        c.Name,
        c.DiscountType.ToString(),
        c.DiscountValue,
        c.PerUserLimit,
        c.TotalUsageLimit,
        myUsageCount,
        c.MinOrderAmount,
        c.StartDate,
        c.EndDate,
        c.Status.ToString(),
        c.Status == CampaignStatus.Completed || (c.TotalUsageLimit.HasValue && c.UsageCount >= c.TotalUsageLimit.Value),
        c.Company?.ServiceCategory is not null ? new ServiceCategoryRefDto(c.Company.ServiceCategory.Id, c.Company.ServiceCategory.Name, c.Company.ServiceCategory.Color) : null,
        c.CreatedAt,
        c.ImageUrl,
        c.Description,
        c.Category.ToString(),
        c.Products.OrderBy(p => p.SortOrder).Select(p => new CampaignProductDto(p.Id, p.Name, p.ImageUrl, p.Price, p.SortOrder)).ToList(),
        isSaved,
        isNew,
        c.Company?.Latitude,
        c.Company?.Longitude,
        distanceKm);
}
