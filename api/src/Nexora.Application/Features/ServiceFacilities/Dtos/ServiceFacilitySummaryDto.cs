namespace Nexora.Application.Features.ServiceFacilities.Dtos;

public record ServiceFacilitySummaryDto(
    int Total,
    int Indoor,
    int Outdoor,
    int Active,
    int Services);
