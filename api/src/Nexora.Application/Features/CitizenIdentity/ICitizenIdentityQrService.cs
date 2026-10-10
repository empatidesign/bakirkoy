namespace Nexora.Application.Features.CitizenIdentity;

public interface ICitizenIdentityQrService
{
    Task<CitizenIdentityQrDto> GenerateAsync(Guid participantId, CancellationToken ct);
    Task<(bool Success, Guid ParticipantId)> TryVerifyAsync(string token, CancellationToken ct);
}
