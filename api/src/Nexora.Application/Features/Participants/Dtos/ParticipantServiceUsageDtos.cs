namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantServiceUsageDto(
    Guid Id,
    string Module,
    Guid ParticipantId,
    string? ParticipantFullName,
    string? ParticipantTckn,
    Guid? BranchId,
    string? BranchName,
    Guid? FacilityId,
    string? FacilityName,
    bool HasReceivedService,
    DateTime? FirstServiceDate,
    DateTime? LastServiceDate,
    string? Note,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record SetParticipantServiceUsageRequest(
    bool HasReceivedService,
    Guid? BranchId,
    string? BranchName,
    Guid? FacilityId,
    string? FacilityName,
    DateTime? FirstServiceDate,
    DateTime? LastServiceDate,
    string? Note);
