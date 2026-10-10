namespace Nexora.Application.Features.Wheels.Dtos;

public record GiftDto(
    Guid Id,
    string Name,
    string? ImageUrl,
    int Points,
    int StockLimit,
    int AwardedCount,
    int Remaining,
    List<int> WinnerPattern,
    string? Description,
    string Status,
    DateTime CreatedAt,
    string ResidencyMode = "anyone");

public record GiftSummaryDto(int Total, int Active, int Passive, int TotalStock, int Awarded);

public record GiftOptionDto(string Value, string Label);

public record GiftUpsertRequest(
    string Name,
    string? ImageUrl,
    int Points,
    int StockLimit,
    List<int>? WinnerPattern,
    string? Description,
    string? ResidencyMode = null);

public record GiftListParams
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
