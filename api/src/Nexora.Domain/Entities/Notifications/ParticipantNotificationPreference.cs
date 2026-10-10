using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Domain.Entities.Notifications;

public class ParticipantNotificationPreference : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public string Category { get; private set; } = "general";
    public bool PushEnabled { get; private set; } = true;
    public bool SmsEnabled { get; private set; } = true;
    public bool EmailEnabled { get; private set; } = true;
    public bool InAppEnabled { get; private set; } = true;
    public string? QuietHoursStart { get; private set; }
    public string? QuietHoursEnd { get; private set; }

    public Participant Participant { get; private set; } = default!;

    private ParticipantNotificationPreference() { }

    public static ParticipantNotificationPreference Create(Guid participantId, string category) => new()
    {
        ParticipantId = participantId,
        Category = category,
    };

    public void Update(bool push, bool sms, bool email, bool inApp, string? quietStart, string? quietEnd)
    {
        PushEnabled = push;
        SmsEnabled = sms;
        EmailEnabled = email;
        InAppEnabled = inApp;
        QuietHoursStart = quietStart;
        QuietHoursEnd = quietEnd;
    }
}
