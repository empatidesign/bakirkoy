namespace Nexora.Application.Features.QrSystem.Dtos;

public record RedeemCampaignRequest(
    Guid ParticipantId,
    Guid? CampaignId,
    string? Notes,
    decimal? OrderAmount = null
);
