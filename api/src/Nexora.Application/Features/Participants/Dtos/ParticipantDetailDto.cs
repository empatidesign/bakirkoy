using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantStatsDto(
    int TotalEvents,
    int CompletedEvents,
    int OngoingEvents,
    int AttendanceRate,
    int SurveyParticipation);

public record ParticipantMonthlyDto(
    int Events,
    int Hours,
    int Points,
    int AttendanceRate);

public record GuardianLinkDto(
    Guid Id,
    string FullName,
    string? PhotoUrl,
    string? Phone,
    string? Relation);

public record ParticipantDetailDto(
    Guid Id,
    string FullName,
    string Tckn,
    string? PhotoUrl,
    DateTime BirthDate,
    int Age,
    string Gender,
    string? Address,
    string? City,
    string? District,
    string? Neighborhood,
    string? DistrictCode,
    string? Email,
    string? Phone,
    bool IsMinor,
    string? GuardianPhone,
    string? GuardianEmail,
    int ChildrenCount,
    int GuardianCount,
    int EventCount,
    string Status,
    string? BlockReason,
    bool IsVerified,
    bool IsFirstLogin,
    DateTime RegisteredAt,
    string? LastEventName,
    DateTime CreatedAt,
    ParticipantStatsDto Stats,
    ParticipantMonthlyDto Monthly,
    List<ParticipantEventDto> RecentEvents,
    List<ParticipantDto> Children,
    List<GuardianLinkDto> Guardians,
    string? AdminNotes,
    List<SedaEducationItemDto> SedaEducations);
