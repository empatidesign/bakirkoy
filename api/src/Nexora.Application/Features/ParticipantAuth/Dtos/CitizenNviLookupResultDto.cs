namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenNviChildDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address);

public record CitizenNviLookupResultDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address,
    bool IsMinor,
    List<CitizenNviChildDto> Children);
