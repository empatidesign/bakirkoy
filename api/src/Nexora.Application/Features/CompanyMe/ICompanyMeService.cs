using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyStaffAuth.Dtos;

namespace Nexora.Application.Features.CompanyMe;

public interface ICompanyMeService
{
    Task<CompanyDto> GetProfileAsync(Guid companyId, CancellationToken ct);
    Task<CompanyDto> UpdateProfileAsync(Guid companyId, UpdateCompanyRequest req, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<PagedResult<CampaignDto>> GetMyCampaignsAsync(Guid companyId, CampaignListParams p, CancellationToken ct);
    Task<CampaignDto> CreateCampaignAsync(Guid companyId, CreateMyCampaignRequest req, CancellationToken ct);
    Task<CampaignDto> UpdateCampaignAsync(Guid companyId, Guid campaignId, UpdateCampaignRequest req, CancellationToken ct);
    Task DeleteCampaignAsync(Guid companyId, Guid campaignId, CancellationToken ct);
    Task<CampaignDto> ToggleCampaignAsync(Guid companyId, Guid campaignId, CancellationToken ct);
    Task<List<ServiceCategoryRefDto>> GetServiceCategoryOptionsAsync(CancellationToken ct);
    Task<ServiceCategoryRefDto> CreateServiceCategoryAsync(Guid companyId, string name, CancellationToken ct);
    Task<CompanyDto> SetServiceCategoryAsync(Guid companyId, Guid? categoryId, CancellationToken ct);
    Task<CampaignRedeemResultDto> RedeemByQrAsync(Guid companyId, string token, decimal? orderAmount, CancellationToken ct);
    Task<CampaignRedeemResultDto> RedeemManualAsync(Guid companyId, Guid campaignId, string? tckn, string? phone, decimal? orderAmount, CancellationToken ct);
    Task<ParticipantPreviewDto> SearchParticipantAsync(Guid companyId, Guid campaignId, SearchParticipantRequest req, CancellationToken ct);
    Task<CampaignRedeemResultDto> ValidateParticipantAsync(Guid companyId, Guid campaignId, Guid participantId, CancellationToken ct);
    Task<List<CompanyOfferingDto>> GetOfferingsAsync(Guid companyId, string? category, bool? isActive, CancellationToken ct);
    Task<CompanyOfferingStatsDto> GetOfferingStatsAsync(Guid companyId, CancellationToken ct);
    Task<CompanyOfferingDto> GetOfferingAsync(Guid companyId, Guid offeringId, CancellationToken ct);
    Task<CompanyOfferingDto> CreateOfferingAsync(Guid companyId, CreateCompanyOfferingRequest req, CancellationToken ct);
    Task<CompanyOfferingDto> UpdateOfferingAsync(Guid companyId, Guid offeringId, UpdateCompanyOfferingRequest req, CancellationToken ct);
    Task DeleteOfferingAsync(Guid companyId, Guid offeringId, CancellationToken ct);
    Task<PagedResult<CompanyCampaignUsageDto>> GetMyCampaignUsagesAsync(Guid companyId, CompanyCampaignUsageListParams p, CancellationToken ct);

    Task<List<CompanyStaffDto>> GetStaffAsync(Guid companyId, CancellationToken ct);
    Task<CompanyStaffDto> CreateStaffAsync(Guid companyId, CreateCompanyStaffRequest req, CancellationToken ct);
    Task<CompanyStaffDto> UpdateStaffAsync(Guid companyId, Guid staffId, UpdateCompanyStaffRequest req, CancellationToken ct);
    Task<ResetCompanyStaffPasswordResultDto> ResetStaffPasswordAsync(Guid companyId, Guid staffId, CancellationToken ct);

    Task SetStaffPasswordAsync(Guid companyId, Guid staffId, SetStaffPasswordRequest req, CancellationToken ct);
    Task<CompanyStaffDto> SetStaffActiveAsync(Guid companyId, Guid staffId, bool isActive, CancellationToken ct);
    Task DeleteStaffAsync(Guid companyId, Guid staffId, CancellationToken ct);
}
