namespace Nexora.Application.Features.ParticipantWheels.Dtos;

public record CitizenWheelSliceDto(
    string Label,
    string Type,
    int Value,
    int WinRate,
    string Color,
    Guid? GiftId,
    string? GiftName);

public record CitizenWheelDto(
    Guid Id,
    string Title,
    string? Description,
    List<CitizenWheelSliceDto> Slices,
    int DailySpinLimit,
    int? RemainingSpinsToday,
    string Status,
    DateTime CreatedAt);

public record CitizenWheelListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CitizenGiftRequestDto(
    Guid Id,
    Guid GiftId,
    string GiftName,
    int GiftPoints,
    int OrderNumber,
    bool IsWinner,
    string Status,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? RejectedAt,
    string? RejectReason);

public record CitizenGiftRequestListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record AvailableGiftDto(
    Guid Id,
    string Name,
    int Points,
    string? ImageUrl,
    int Remaining,
    bool HasPendingRequest);

public record AvailableGiftsResultDto(
    int Balance,
    List<AvailableGiftDto> Gifts);
