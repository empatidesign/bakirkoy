using Nexora.Domain.Entities.Notifications;

namespace Nexora.Application.Common.Repositories;

public interface IParticipantNotificationPreferenceRepository : IRepository<ParticipantNotificationPreference>
{
    Task<List<ParticipantNotificationPreference>> GetByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<ParticipantNotificationPreference?> GetAsync(Guid participantId, string category, CancellationToken ct);
}
