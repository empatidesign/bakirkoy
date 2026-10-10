namespace Nexora.Application.Features.Wheels.Dtos;

public record GiftRequestDto(
    Guid Id,
    Guid GiftId,
    string GiftName,
    int GiftPoints,
    string CitizenName,
    string CitizenTc,
    string CitizenPhone,
    int OrderNumber,
    bool IsWinner,
    string Status,
    string Source,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    string? ApprovedBy,
    DateTime? RejectedAt,
    string? RejectedBy,
    string? RejectReason,
    DateTime? DeliveredAt,
    string? DeliveredBy,
    string? DeliveryNote);

public record GiftRequestSummaryDto(int Total, int Pending, int Approved, int Rejected, int Winners, int WinnersPending);

public record GiftRequestRejectRequest(string? Reason);

public record GiftRequestDeliverRequest(string? Note);

public record GiftRequestListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? GiftId { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
