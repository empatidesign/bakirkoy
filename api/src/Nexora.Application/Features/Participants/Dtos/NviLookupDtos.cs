namespace Nexora.Application.Features.Participants.Dtos;

public record NviLookupRequest(string Tckn, DateTime BirthDate);

public record NviChildResultDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address);

public record NviLookupResultDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address,
    bool IsMinor,
    List<NviChildResultDto> Children);

public record ParticipantLookupResultDto(bool Exists, ParticipantDetailDto? Participant);
