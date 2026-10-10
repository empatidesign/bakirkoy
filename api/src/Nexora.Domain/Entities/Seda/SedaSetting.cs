using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaSetting : BaseEntity
{
    public bool ApplicationsOpen { get; private set; }
    public bool RequireApproval { get; private set; } = true;
    public bool AutoCloseWhenFull { get; private set; } = true;
    public string NotificationTemplatesJson { get; private set; } = "[]";

    public static SedaSetting CreateDefault() => new()
    {
        ApplicationsOpen = false,
        RequireApproval = true,
        AutoCloseWhenFull = true,
        NotificationTemplatesJson = "[]",
    };

    public void Update(bool applicationsOpen, bool requireApproval, bool autoCloseWhenFull, string? notificationTemplatesJson = null)
    {
        ApplicationsOpen = applicationsOpen;
        RequireApproval = requireApproval;
        AutoCloseWhenFull = autoCloseWhenFull;
        if (notificationTemplatesJson is not null)
            NotificationTemplatesJson = string.IsNullOrWhiteSpace(notificationTemplatesJson) ? "[]" : notificationTemplatesJson;
        UpdatedAt = DateTime.UtcNow;
    }
}
