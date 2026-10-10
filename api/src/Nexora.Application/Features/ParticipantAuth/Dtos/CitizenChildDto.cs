using Nexora.Domain.Enums;

namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenChildDto(
    Guid Id,
    string FullName,
    string Tckn,
    DateTime BirthDate,
    int Age,
    Gender Gender,
    bool IsMinor,
    ParticipantStatus Status,
    string? PhotoUrl);
