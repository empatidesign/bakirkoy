namespace Nexora.Application.Features.NotificationPreferences.Dtos;

public static class NotificationCategories
{
    public const string Event = "event";
    public const string Travel = "travel";
    public const string Facility = "facility";
    public const string Campaign = "campaign";
    public const string Library = "library";
    public const string General = "general";

    public static readonly string[] All = [Event, Travel, Facility, Campaign, Library, General];

    public static bool IsValid(string category) => All.Contains(category);
}

public record NotificationPreferenceDto(
    Guid? Id,
    string Category,
    bool PushEnabled,
    bool SmsEnabled,
    bool EmailEnabled,
    bool InAppEnabled,
    string? QuietHoursStart,
    string? QuietHoursEnd);

public record NotificationDeliveryDecision(
    bool InAppEnabled,
    bool PushEnabled,
    bool SmsEnabled,
    bool IsQuietNow);

public record UpsertNotificationPreferenceRequest(
    string Category,
    bool PushEnabled,
    bool SmsEnabled,
    bool EmailEnabled,
    bool InAppEnabled,
    string? QuietHoursStart,
    string? QuietHoursEnd);
