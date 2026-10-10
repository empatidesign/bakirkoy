using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ParticipantNotificationPreferenceRepository(AppDbContext context)
    : Repository<ParticipantNotificationPreference>(context), IParticipantNotificationPreferenceRepository
{
    public async Task<List<ParticipantNotificationPreference>> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.Where(x => x.ParticipantId == participantId).ToListAsync(ct);

    public async Task<ParticipantNotificationPreference?> GetAsync(Guid participantId, string category, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.ParticipantId == participantId && x.Category == category, ct);
}
