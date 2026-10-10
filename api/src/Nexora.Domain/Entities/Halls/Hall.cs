using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Halls;

public class Hall : BaseEntity
{
    public string Name { get; private set; } = "";
    public Guid FacilityId { get; private set; }
    public string? FacilityName { get; private set; }
    public string Type { get; private set; } = "";
    public int? BuildingFloor { get; private set; }
    public string SeatingMode { get; private set; } = "seated";
    public int Capacity { get; private set; }
    public int FloorCount { get; private set; }
    public string? LayoutJson { get; private set; }
    public string? SeatStatesJson { get; private set; }
    public List<string> FeatureIds { get; private set; } = [];
    public string? Description { get; private set; }
    public string? About { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static Hall Create(
        Guid facilityId, string? facilityName, string name, string type, int? buildingFloor,
        string seatingMode, int capacity, int floorCount, string? layoutJson,
        List<string> featureIds, string? description, string? about)
        => new()
        {
            FacilityId = facilityId,
            FacilityName = facilityName,
            Name = name.Trim(),
            Type = type,
            BuildingFloor = buildingFloor,
            SeatingMode = seatingMode,
            Capacity = capacity,
            FloorCount = floorCount,
            LayoutJson = layoutJson,
            FeatureIds = featureIds,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            About = string.IsNullOrWhiteSpace(about) ? null : about.Trim(),
        };

    public void Update(
        Guid facilityId, string? facilityName, string name, string type, int? buildingFloor,
        string seatingMode, int capacity, int floorCount, string? layoutJson,
        List<string> featureIds, string? description, string? about)
    {
        FacilityId = facilityId;
        FacilityName = facilityName;
        Name = name.Trim();
        Type = type;
        BuildingFloor = buildingFloor;
        SeatingMode = seatingMode;
        Capacity = capacity;
        FloorCount = floorCount;
        LayoutJson = layoutJson;
        FeatureIds = featureIds;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        About = string.IsNullOrWhiteSpace(about) ? null : about.Trim();
    }

    public void SetSeatStates(string? json) => SeatStatesJson = json;

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
