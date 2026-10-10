namespace Nexora.Application.Features.Events.Dtos;

public record ApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? EventId { get; init; }
    public Guid? SessionId { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record ApplicationFormRequest(
    Guid ParticipantId,
    Guid EventId,
    string? SessionId,
    string Status,
    string DocumentStatus,
    string PaymentStatus,
    string? SeatNumber
);

public record SetApplicationStatusRequest(string Status, string? Reason = null);
