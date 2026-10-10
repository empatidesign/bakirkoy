using Nexora.Application.Features.NotificationPreferences.Dtos;

namespace Nexora.Application.Features.NotificationPreferences;

public interface INotificationPreferenceService
{
    Task<List<NotificationPreferenceDto>> GetPreferencesAsync(Guid participantId, CancellationToken ct);

    Task<NotificationPreferenceDto> UpsertPreferenceAsync(Guid participantId, UpsertNotificationPreferenceRequest req, CancellationToken ct);

    Task OptOutAllAsync(Guid participantId, CancellationToken ct);

    Task<bool> IsChannelEnabledAsync(Guid participantId, string category, string channel, CancellationToken ct);

    Task<NotificationDeliveryDecision> GetDeliveryAsync(Guid participantId, string category, CancellationToken ct);
}
