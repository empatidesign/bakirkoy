namespace Nexora.Application.Features.Halls.Dtos;

public record SeatingFloorDto(
    string Id,
    string Name,
    int Rows,
    List<int> DefaultSegments,
    Dictionary<int, List<int>> RowOverrides,
    List<int> CrossAisles,
    string RowLabelStart,
    bool SkipIO);

public record SeatingLayoutDto(string Template, List<SeatingFloorDto> Floors);

public record HallDto(
    Guid Id,
    string Name,
    Guid FacilityId,
    string? FacilityName,
    string Type,
    int? BuildingFloor,
    string SeatingMode,
    int Capacity,
    int AvailableCapacity,
    int FloorCount,
    SeatingLayoutDto? Layout,
    List<string> FeatureIds,
    string? Description,
    string? About,
    bool IsActive,
    DateTime CreatedAt);

public record HallSummaryDto(int Total, int Active, int Passive, int TotalCapacity);
