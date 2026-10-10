using Nexora.Application.Features.QrSystem.Dtos;

namespace Nexora.Application.Features.QrSystem;

public interface IQrSystemService
{
    Task<CitizenQrTokenDto> GenerateCitizenTokenAsync(Guid participantId, CancellationToken ct);
    Task<ScanCitizenQrResultDto> ScanCitizenQrAsync(string token, Guid companyId, CancellationToken ct);
    Task<RedemptionDto> RedeemCampaignAsync(Guid companyId, RedeemCampaignRequest req, CancellationToken ct);
    Task<RedemptionDto> RedeemCampaignByStaticCodeAsync(string staticCode, RedeemCampaignRequest req, CancellationToken ct);

    Task<CompanyQrCodeDto> GenerateCompanyQrAsync(Guid companyId, GenerateCompanyQrRequest req, CancellationToken ct);
    Task<ScanCompanyQrResultDto> ScanCompanyQrAsync(string staticCode, Guid participantId, CancellationToken ct);
    Task DeactivateCompanyQrAsync(Guid qrCodeId, Guid companyId, CancellationToken ct);

    Task<List<RedemptionDto>> GetCompanyRedemptionsAsync(Guid companyId, CancellationToken ct);
    Task<List<RedemptionDto>> GetParticipantRedemptionsAsync(Guid participantId, CancellationToken ct);
}
