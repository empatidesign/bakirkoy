namespace Nexora.Application.Features.Events.Dtos;

public record SessionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? EventId { get; init; }
    public Guid? CategoryId { get; init; }
    public Guid? FacilityId { get; init; }
    public Guid? HallId { get; init; }
    public bool? IsActive { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SessionSlot(string StartTime, string EndTime);

public record SessionDayPlan(string Day, List<SessionSlot> Slots);

public record SessionFormRequest(
    Guid EventId,
    Guid? HallId,
    string Mode,
    DateTime Date,
    string StartTime,
    string EndTime,
    DateTime StartDate,
    DateTime EndDate,
    List<SessionDayPlan> DayPlans,
    int Capacity,
    int ReserveCapacity,
    string? Instructor,
    string? InstructorId,
    string? InstructorPhone,
    string? InstructorEmail,
    string? EmergencyPhone,
    bool IsActive,
    bool GrantAccess = false,
    string? Tckn = null,
    string? RoleTemplateKey = null,
    string? DeliveryChannel = null
);

public record SessionConflictDto(
    DateTime Date,
    string Day,
    string StartTime,
    string EndTime,
    string Reason,
    string? HallName,
    string? ConflictEventName
);
