using Nexora.Application.Features.NotificationPreferences.Dtos;

namespace Nexora.Application.Features.NotificationPreferences;

public static class NotificationCategoryMap
{
    public static string Resolve(string? type)
    {
        if (string.IsNullOrWhiteSpace(type))
            return NotificationCategories.General;

        var key = type.Trim().ToLowerInvariant();

        if (key.StartsWith("broadcast:"))
            key = key["broadcast:".Length..];
        else if (key == "broadcast")
            return NotificationCategories.General;

        if (key.StartsWith("facility"))
            return NotificationCategories.Facility;
        if (key.StartsWith("library"))
            return NotificationCategories.Library;
        if (key.StartsWith("travel"))
            return NotificationCategories.Travel;
        if (key.StartsWith("campaign"))
            return NotificationCategories.Campaign;
        if (key.StartsWith("event") || key.StartsWith("session") || key.StartsWith("hall"))
            return NotificationCategories.Event;
        if (key.StartsWith("muhtarlik"))
            return NotificationCategories.General;

        return key switch
        {
            "application" => NotificationCategories.Event,
            "facilitygroup" or "facilityapplication" => NotificationCategories.Facility,
            "eventhall" => NotificationCategories.Event,
            _ => NotificationCategories.General,
        };
    }
}
