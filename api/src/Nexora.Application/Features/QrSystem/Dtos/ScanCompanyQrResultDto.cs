namespace Nexora.Application.Features.QrSystem.Dtos;

public record ScanCompanyQrResultDto(
    Guid CompanyId,
    string CompanyName,
    string? LogoUrl,
    List<ActiveCampaignDto> ActiveCampaigns
);
