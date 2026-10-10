namespace Nexora.Application.Features.Events.Dtos;

public record SessionDto(
    Guid Id,
    string Code,
    Guid EventId,
    string EventName,
    string EventCategoryName,
    string EventCategoryColor,
    Guid? HallId,
    string? HallName,
    Guid? FacilityId,
    string? FacilityName,
    DateTime Date,
    string Day,
    string StartTime,
    string EndTime,
    int Capacity,
    int ReserveCapacity,
    int RegisteredCount,
    int ReserveCount,
    bool IsActive,
    string? Instructor,
    Guid? InstructorId,
    string? InstructorPhone,
    string? InstructorEmail,
    string? EmergencyPhone,
    string? CreatedBy
);

public record SessionSummaryDto(int Total, int Active, int Passive, int TotalRegistered, int TotalCapacity);

public record SessionOptionDto(Guid Id, string Label);

public record GenerateResultDto(int Created, int Skipped);

public record HallSeatChangeImpactDto(int AffectedSessions, int Reassigned, int ManualPending, int CapacityReduced);
