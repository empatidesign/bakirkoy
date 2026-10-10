namespace Nexora.Application.Features.Wheels.Dtos;

public record WheelSliceDto(
    string Label,
    string Type,
    int Value,
    int WinRate,
    string Color,
    Guid? GiftId,
    string? GiftName);

public record WheelDto(
    Guid Id,
    string Title,
    string? Description,
    List<WheelSliceDto> Slices,
    int DailySpinLimit,
    string Status,
    int TotalSpins,
    DateTime CreatedAt,
    // Kullanıcı isteği (2026-09-20): opsiyonel puan algoritması — günün kaçıncı
    // çevirmesi olduğuna göre değişen puan. Bkz. Wheel.ComputeAlgorithmPoints.
    bool PointsAlgorithmEnabled = false,
    int PointsAlgorithmBase = 0,
    int PointsAlgorithmStep = 0,
    int PointsAlgorithmMax = 0,
    int PointsAlgorithmMaxSpins = 0,
    string ResidencyMode = "anyone");

public record WheelSummaryDto(int Total, int Active, int Passive, int TotalSpins);

public record WheelSliceInput(
    string Label,
    string Type,
    int Value,
    int WinRate,
    string Color,
    Guid? GiftId);

public record WheelUpsertRequest(
    string Title,
    string? Description,
    int DailySpinLimit,
    List<WheelSliceInput> Slices,
    bool PointsAlgorithmEnabled = false,
    int PointsAlgorithmBase = 0,
    int PointsAlgorithmStep = 0,
    int PointsAlgorithmMax = 0,
    int PointsAlgorithmMaxSpins = 0,
    string? ResidencyMode = null);

public record WheelSpinResultDto(
    string SliceLabel,
    string SliceType,
    int SliceValue,
    Guid? GiftId,
    Guid? GiftRequestId,
    int? PointsWon,
    int? RemainingSpinsToday);

public record WheelListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
