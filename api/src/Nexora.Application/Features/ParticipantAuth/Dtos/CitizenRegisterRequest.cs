namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenRegisterRequest(
    string Tckn,
    DateTime BirthDate,
    string Phone,
    string Email,
    string Password,
    string? GuardianPhone,
    string? GuardianEmail);
