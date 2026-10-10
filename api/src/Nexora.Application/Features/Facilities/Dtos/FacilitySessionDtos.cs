namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilitySessionDto(
    Guid Id,
    string Module,
    Guid FacilityId,
    Guid GroupId,
    string? GroupName,
    DateTime Date,
    string Day,
    string StartTime,
    string EndTime,
    bool AttendanceTaken,
    bool IsCancelled,
    string? CancelReason,
    bool IsActive,
    string AttendanceMode,
    string? BranchName = null,
    int? AgeMin = null,
    int? AgeMax = null,
    bool LateTrackingEnabled = true
);

public record GenerateSessionsRequest(Guid GroupId);

public record CreateManualSessionRequest(Guid FacilityId, Guid GroupId, string Date, string StartTime, string EndTime);

public record GenerateSessionsResult(int Generated, int Skipped);

public record CancelSessionRequest(string? Reason);

public record BulkCancelSessionsRequest(Guid? FacilityId, List<Guid>? GroupIds, DateTime StartDate, DateTime? EndDate, string? Reason);

public record BulkReopenSessionsRequest(Guid? FacilityId, List<Guid>? GroupIds, DateTime StartDate, DateTime? EndDate);

public record BulkSessionsResult(int AffectedSessions, int NotifiedUsers);

public record ScheduleSyncResult(
    int RemovedEmptySessions,
    int ProtectedApplicationSessions,
    int ProtectedAttendanceSessions,
    bool RequiresAttendanceConfirmation
);
