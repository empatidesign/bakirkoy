using Microsoft.Extensions.Configuration;

namespace Nexora.Infrastructure.Services;

public static class ScheduledNotificationSwitch
{
    public const string ConfigKey = "NotificationSettings:ScheduledNotificationsEnabled";

    public static bool SendsEnabled(IConfiguration config) => config.GetValue(ConfigKey, true);
}
