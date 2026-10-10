using Nexora.Domain.Entities.Facilities;

namespace Nexora.Application.Features.Facilities;

public record FacilityNotificationVars(
    string? GroupName = null,
    string? FacilityName = null,
    string? Date = null,
    string? Reason = null,
    int? WaitlistPosition = null,
    string? SessionDate = null,
    int? AbsenceCount = null,
    int? RemainingRight = null,
    int? Limit = null,
    string? SessionTime = null,
    string? ConfirmHours = null,
    string? DocumentList = null,
    string? CancelReason = null);

public interface IFacilityNotificationService
{
    Task SendStatusAsync(string module, string statusEvent, string? phone, string fullName, FacilityNotificationVars vars, CancellationToken ct, Guid? participantId = null);
    Task NotifyAttendanceAsync(FacilitySession session, string groupName, IReadOnlyList<(FacilityRegistration Registration, string Status)> results, CancellationToken ct);
    Task NotifySessionCancelledAsync(FacilitySession session, string groupName, IReadOnlyList<FacilityRegistration> roster, string? reason, CancellationToken ct);
    Task NotifyBulkSessionsCancelledAsync(IReadOnlyList<FacilityRegistration> participants, string scopeLabel, DateTime startDate, DateTime endDate, string? reason, CancellationToken ct);
    Task NotifySessionReopenedAsync(FacilitySession session, string groupName, IReadOnlyList<FacilityRegistration> roster, CancellationToken ct);
    Task NotifyBulkSessionsReopenedAsync(IReadOnlyList<FacilityRegistration> participants, string scopeLabel, DateTime startDate, DateTime endDate, CancellationToken ct);
    Task NotifyInstructorAttendanceReminderAsync(string? instructorPhone, string instructorName, DateTime sessionDate, string startTime, string groupName, string link, int remainingMinutes, CancellationToken ct);
}
