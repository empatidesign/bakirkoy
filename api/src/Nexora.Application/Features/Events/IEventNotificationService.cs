using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Application.Features.Events;

public interface IEventNotificationService
{
    Task SendApplicationStatusAsync(
        string statusEvent,
        Participant participant,
        Event ev,
        Session? session,
        string? reason,
        int? waitlistPosition = null,
        CancellationToken ct = default);
}
