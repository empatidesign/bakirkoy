using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public class Session : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public Guid EventId { get; private set; }
    public Guid? HallId { get; private set; }
    public DateTime Date { get; private set; }
    public string StartTime { get; private set; } = string.Empty;
    public string EndTime { get; private set; } = string.Empty;
    public int Capacity { get; private set; }
    public int ReserveCapacity { get; private set; }
    public int RegisteredCount { get; private set; }
    public int ReserveCount { get; private set; }
    public string? Instructor { get; private set; }
    public Guid? InstructorId { get; private set; }
    public string? InstructorPhone { get; private set; }
    public string? InstructorEmail { get; private set; }
    public string? EmergencyPhone { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? SeatStatesJson { get; private set; }

    public static Session Create(
        Guid eventId, Guid? hallId, DateTime date, string startTime, string endTime,
        int capacity, int reserveCapacity, string? instructor, bool isActive, string code, string? actor)
        => new()
        {
            Code = code,
            EventId = eventId,
            HallId = hallId,
            Date = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified),
            StartTime = startTime,
            EndTime = endTime,
            Capacity = capacity < 0 ? 0 : capacity,
            ReserveCapacity = reserveCapacity < 0 ? 0 : reserveCapacity,
            Instructor = string.IsNullOrWhiteSpace(instructor) ? null : instructor.Trim(),
            IsActive = isActive,
            CreatedBy = actor,
        };

    public void Update(Guid? hallId, DateTime date, string startTime, string endTime,
        int capacity, int reserveCapacity, string? instructor, bool isActive)
    {
        HallId = hallId;
        Date = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
        StartTime = startTime;
        EndTime = endTime;
        Capacity = capacity < 0 ? 0 : capacity;
        ReserveCapacity = reserveCapacity < 0 ? 0 : reserveCapacity;
        Instructor = string.IsNullOrWhiteSpace(instructor) ? null : instructor.Trim();
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetResponsible(Guid? instructorId, string? phone, string? email, string? emergencyPhone)
    {
        InstructorId = instructorId;
        InstructorPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        InstructorEmail = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        EmergencyPhone = string.IsNullOrWhiteSpace(emergencyPhone) ? null : emergencyPhone.Trim();
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void SetSeatStates(string? json) => SeatStatesJson = json;
    public void SetCapacity(int capacity) => Capacity = capacity < 0 ? 0 : capacity;
}
