using Nexora.Domain.Enums;

namespace Nexora.Application.Features.QrSystem.Dtos;

public record ActiveCampaignDto(
    Guid Id,
    string Name,
    DiscountType DiscountType,
    decimal DiscountValue,
    DateTime EndDate,
    string? Description,
    decimal? MinOrderAmount
);
