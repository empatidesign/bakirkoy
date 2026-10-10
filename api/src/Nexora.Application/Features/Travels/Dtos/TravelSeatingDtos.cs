using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelSeatOccupantDto(string SeatNumber, string Gender, string? Name = null);

public record TravelBusSeatingDto(
    Guid BusId,
    string Name,
    string PlateNumber,
    string TemplateId,
    int Capacity,
    JsonElement SeatStates,
    List<string> LockedSeatIds,
    List<TravelSeatOccupantDto> Occupants,
    string VehicleType,
    int OccupiedCount
);

public record SaveTravelSeatingRequest(JsonElement SeatStates);

public record BusSeatChangeImpactDto(int AffectedTravels, int Reassigned, int ManualPending, int CapacityReduced);

public record SeatedPassengerNameDto(string SeatNumber, string FullName, string Gender);

/// <summary>Kullanıcı isteği (2026-08-04): refakatçi koltuğunun ismini de taşıyan occupant bilgisi.
/// CompanionName boşsa (kontenjanlı gezilerden kalma eski kayıtlar) "Refakatçi" gösterilir.</summary>
