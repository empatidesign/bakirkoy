namespace Nexora.Application.Features.Travels.Dtos;

public record TravelAttendanceRosterItemDto(
    Guid PassengerId,
    Guid ApplicationId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string? BusName,
    string? SeatNumber,
    string Status);

public record TravelAttendanceRosterDto(
    Guid TravelId,
    string TravelName,
    DateTime StartDate,
    DateTime EndDate,
    bool Started,
    bool Ended,
    bool Taken,
    DateTime? TakenAt,
    DateTime? ReminderSentAt,
    bool Overdue,
    List<TravelAttendanceRosterItemDto> Items);

public record TravelAttendanceMarkDto(Guid PassengerId, string Status);

public record SaveTravelAttendanceRequest(List<TravelAttendanceMarkDto> Marks);

public record SaveTravelAttendanceResultDto(int Marked);
