using Nexora.Domain.Entities.Participants;

namespace Nexora.Application.Common.Repositories;

public interface IParticipantDevicePermissionRepository : IRepository<ParticipantDevicePermission>
{
    Task<ParticipantDevicePermission?> GetByParticipantAsync(Guid participantId, CancellationToken ct);
}
