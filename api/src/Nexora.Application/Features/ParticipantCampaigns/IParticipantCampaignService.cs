using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.ParticipantCampaigns.Dtos;

namespace Nexora.Application.Features.ParticipantCampaigns;

public interface IParticipantCampaignService
{
    Task<PagedResult<CitizenCampaignDto>> GetListAsync(CitizenCampaignListParams p, CancellationToken ct);
    Task<CitizenCampaignDto> GetDetailAsync(Guid id, CancellationToken ct);
    Task<CitizenCampaignRedeemDto> RedeemAsync(Guid id, CancellationToken ct);
    Task<List<ServiceCategoryRefDto>> GetCategoriesAsync(CancellationToken ct);
    Task<List<CitizenCampaignUsageDto>> GetMyUsagesAsync(CancellationToken ct);
    Task<CampaignSettingsDto> GetSettingsAsync(CancellationToken ct);
    Task SetBookmarkAsync(Guid campaignId, bool saved, CancellationToken ct);
    Task<CitizenCampaignCompanyDto> GetCompanyAsync(Guid companyId, CancellationToken ct);
    Task<PagedResult<CitizenDirectoryCompanyDto>> GetDirectoryAsync(CitizenDirectoryCompanyListParams p, CancellationToken ct);
    Task<List<string>> GetDirectoryDistrictsAsync(CancellationToken ct);
    Task<CitizenDirectoryCompanyDto> GetDirectoryCompanyAsync(Guid companyId, double? latitude, double? longitude, CancellationToken ct);
}
