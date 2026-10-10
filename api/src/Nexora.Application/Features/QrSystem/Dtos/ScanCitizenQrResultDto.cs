namespace Nexora.Application.Features.QrSystem.Dtos;

public record ScanCitizenQrResultDto(
    Guid ParticipantId,
    string FullName,
    string? PhotoUrl,
    List<ActiveCampaignDto> ActiveCampaigns
);
