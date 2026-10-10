namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantEventDto(
    Guid Id,
    Guid PersonId,
    string PersonName,
    string EventName,
    DateTime Date,
    string? Time,
    string Venue,
    string Category,
    string Attendance,
    string Approval);

public record ParticipantEventCountsDto(int All, int Attended, int Missed, int Excused);

public record ParticipantEventResultDto
{
    public List<ParticipantEventDto> Items { get; init; } = [];
    public int Total { get; init; }
    public int Page { get; init; }
    public int Limit { get; init; }
    public int TotalPages => Limit > 0 ? (int)Math.Ceiling((double)Total / Limit) : 0;
    public ParticipantEventCountsDto Counts { get; init; } = new(0, 0, 0, 0);
}

public record ParticipantEventListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 10;
    public Guid? ParticipantId { get; init; }
    public Guid? PersonId { get; init; }
    public string? Attendance { get; init; }
    public string? Search { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
