using Nexora.Domain.Enums;

namespace Nexora.Application.Features.QrSystem.Dtos;

public record RedemptionDto(
    Guid Id,
    string RedemptionCode,
    RedemptionType RedemptionType,
    Guid ParticipantId,
    string ParticipantName,
    Guid CompanyId,
    string CompanyName,
    Guid? CampaignId,
    string? CampaignName,
    string? Notes,
    DateTime RedeemedAt
);
