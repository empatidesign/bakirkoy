namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantSummaryDto(
    int Total,
    int Active,
    int Passive,
    int Blocked,
    int Deleted);
