namespace Nexora.Application.Features.Participants.Dtos;

public record UpdateAdminNotesRequest(string? Notes);

public record AppointmentKeyDto(string? Key);

public record CreateParticipantRequest(
    string Tckn,
    DateTime BirthDate,
    string? Email,
    string? Phone,
    string? GuardianPhone,
    string? GuardianEmail,
    string DeliveryChannel);
