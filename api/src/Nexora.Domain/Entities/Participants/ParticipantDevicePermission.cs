using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Participants;

public class ParticipantDevicePermission : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public string LocationStatus { get; private set; } = "not_asked";
    public string NotificationStatus { get; private set; } = "not_asked";
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public DateTime? LocationUpdatedAt { get; private set; }
    public string? PushToken { get; private set; }
    public string? DevicePlatform { get; private set; }
    public DateTime? RespondedAt { get; private set; }

    public Participant Participant { get; private set; } = default!;

    private ParticipantDevicePermission() { }

    public static ParticipantDevicePermission Create(Guid participantId) => new()
    {
        ParticipantId = participantId,
    };

    public void SetLocation(string status, double? latitude, double? longitude)
    {
        LocationStatus = status;
        if (status == "granted" && latitude.HasValue && longitude.HasValue)
        {
            Latitude = latitude;
            Longitude = longitude;
            LocationUpdatedAt = DateTime.UtcNow;
        }
        MarkResponded();
    }

    public void SetNotification(string status, string? pushToken, string? devicePlatform)
    {
        NotificationStatus = status;
        if (!string.IsNullOrWhiteSpace(pushToken))
        {
            PushToken = pushToken;
            DevicePlatform = devicePlatform;
        }
        MarkResponded();
    }

    public void ClearPushToken() => PushToken = null;

    private void MarkResponded() => RespondedAt = DateTime.UtcNow;
}
