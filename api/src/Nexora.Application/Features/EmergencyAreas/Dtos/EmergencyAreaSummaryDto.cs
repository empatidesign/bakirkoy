namespace Nexora.Application.Features.EmergencyAreas.Dtos;

public record EmergencyAreaSummaryDto(
    int Total,
    int Active,
    int Passive,
    int TotalCapacity,
    int TotalAreaM2);
