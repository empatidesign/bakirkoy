using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelBus : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string PlateNumber { get; private set; } = string.Empty;
    public string TemplateId { get; private set; } = string.Empty;
    public int Capacity { get; private set; }
    public string SeatStatesJson { get; private set; } = "{}";
    public int OccupiedCount { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public Guid? SourceBusId { get; private set; }

    public string VehicleType { get; private set; } = "bus";
    public bool IsCapacityOnly => VehicleType == "capacity";

    public static TravelBus Create(
        string name, string plateNumber, string vehicleType, string templateId, int capacity,
        string seatStatesJson, int occupiedCount, string? actor, Guid? sourceBusId = null)
        => new()
        {
            Name = name.Trim(),
            PlateNumber = plateNumber?.Trim() ?? string.Empty,
            VehicleType = NormalizeVehicleType(vehicleType),
            TemplateId = templateId?.Trim() ?? string.Empty,
            Capacity = capacity < 0 ? 0 : capacity,
            SeatStatesJson = string.IsNullOrWhiteSpace(seatStatesJson) ? "{}" : seatStatesJson,
            OccupiedCount = occupiedCount < 0 ? 0 : occupiedCount,
            CreatedBy = actor,
            SourceBusId = sourceBusId,
        };

    public void Update(
        string name, string plateNumber, string vehicleType, string templateId, int capacity,
        string seatStatesJson, int occupiedCount)
    {
        Name = name.Trim();
        PlateNumber = plateNumber?.Trim() ?? string.Empty;
        VehicleType = NormalizeVehicleType(vehicleType);
        TemplateId = templateId?.Trim() ?? string.Empty;
        Capacity = capacity < 0 ? 0 : capacity;
        SeatStatesJson = string.IsNullOrWhiteSpace(seatStatesJson) ? "{}" : seatStatesJson;
        OccupiedCount = occupiedCount < 0 ? 0 : occupiedCount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetSeatStates(string seatStatesJson, int occupiedCount)
    {
        SeatStatesJson = string.IsNullOrWhiteSpace(seatStatesJson) ? "{}" : seatStatesJson;
        OccupiedCount = occupiedCount < 0 ? 0 : occupiedCount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOccupiedCount(int occupiedCount)
    {
        OccupiedCount = occupiedCount < 0 ? 0 : occupiedCount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    private static string NormalizeVehicleType(string? value)
        => value == "capacity" ? "capacity" : "bus";
}

