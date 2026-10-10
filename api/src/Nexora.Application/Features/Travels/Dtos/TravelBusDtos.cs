using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelBusDto(
    Guid Id,
    string? TravelName,
    string Name,
    string PlateNumber,
    string TemplateId,
    int Capacity,
    JsonElement SeatStates,
    int OccupiedCount,
    bool IsActive,
    string VehicleType,
    Guid? SourceBusId
);

public record TravelBusSummaryDto(int TotalBuses, int TotalCapacity, int TotalOccupied, int ActiveTravels);

/// <summary>
/// Bir aracın (ve varsa ondan çoğaltılmış kopyaların) hangi seferlerde kullanıldığının izlenebilirliği.
/// </summary>
public record TravelBusUsageEntryDto(Guid TravelId, string TravelName, string TravelCode, DateTime StartDate, DateTime EndDate, bool IsClone);

public record TravelBusUsageHistoryDto(
    Guid BusId,
    string BusName,
    Guid? SourceBusId,
    string? SourceBusName,
    List<TravelBusUsageEntryDto> UsedInTravels
);
