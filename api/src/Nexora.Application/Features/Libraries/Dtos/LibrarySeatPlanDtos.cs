namespace Nexora.Application.Features.Libraries.Dtos;

public record SeatDto(
    string Key,
    string Label,
    int Number,
    string Status,
    string? OccupantName,
    DateTime? EntryTime,
    string? ReservedFor,
    string? SessionId,
    string? BreakType = null,
    string? ReservationId = null);

public record SeatFloorDto(string Id, string Name, int Capacity, bool Active, string? KrokiUrl, List<SeatDto> Seats, List<SeatSectionDto>? Sections = null);

public record LibrarySeatPlanDto(
    string SeatingMode,
    List<SeatFloorDto> Floors,
    int Total,
    int Occupied,
    int OnBreak,
    int OnBreakShort,
    int OnBreakLong,
    int Reserved,
    int Maintenance,
    int Available);

public record SeatMaintenanceRequest(List<string> MaintenanceKeys);

public record LibraryLayoutDto(bool IsMultiFloor, List<LibraryFloorDto> Floors);
