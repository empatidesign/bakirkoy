using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ParticipantDevicePermissionRepository(AppDbContext context)
    : Repository<ParticipantDevicePermission>(context), IParticipantDevicePermissionRepository
{
    public async Task<ParticipantDevicePermission?> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.ParticipantId == participantId, ct);
}
