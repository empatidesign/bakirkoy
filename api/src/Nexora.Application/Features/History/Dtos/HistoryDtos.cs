using Nexora.Application.Common.ApiResponse;

namespace Nexora.Application.Features.History.Dtos;

public record HistoryItemDto(
    Guid ApplicationId,
    string Type,
    Guid SourceId,
    string Title,
    string CategoryName,
    string CategoryColor,
    DateTime StartDate,
    DateTime EndDate,
    string? ImageUrl,
    string Status,
    DateTime AppliedAt,
    bool HasReviewed,
    bool CanReview,
    bool CheckedIn,
    string? FacilityName = null,
    string? HallName = null,
    string? SeatNumber = null,
    string? Location = null,
    string? ReservationType = null
);

public record HistoryListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Type { get; init; }
}
