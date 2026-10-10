namespace Nexora.Application.Features.Events.Dtos;

public record ActivityListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public DateTime? Date { get; init; }
    public string? Kind { get; init; }
    public Guid? EventId { get; init; }
    public Guid? SessionId { get; init; }
    public Guid? HallId { get; init; }
    public string? Search { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record QrCodeListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? EventId { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CheckInRequest(
    string? QrCode,
    Guid? EventId,
    Guid? SessionId,
    Guid? ParticipantId,
    string? ParticipantName,
    string? Tckn,
    string Method,
    string Kind,
    bool WalkIn,
    double? Latitude = null,
    double? Longitude = null
);
