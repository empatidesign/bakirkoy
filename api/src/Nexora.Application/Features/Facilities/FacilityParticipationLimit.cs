using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

public static class FacilityParticipationLimit
{
    public static (string Type, int Count) Resolve(bool overrideEnabled, string? groupType, int groupCount, string? generalSettingsJson)
    {
        if (overrideEnabled)
            return IsActive(groupType, groupCount) ? (groupType!, groupCount) : ("unlimited", 0);
        return ParseGeneral(generalSettingsJson);
    }

    // K02: dinamik override önceliği tek kaynak — etkin yaş sınıfı override → grup override → genel ayar.
    // Yaş bilinmiyorsa (age null) yaş sınıfı katmanı atlanır (grup/genel). Hem vatandaş hem yönetim yolu bunu kullanır.
    public static (string Type, int Count) ResolveEffective(string? generalSettingsJson, bool groupOverride, string? groupType, int groupCount, int? age)
    {
        if (age.HasValue)
        {
            var cls = FacilityParticipationClass.ResolveForAge(generalSettingsJson, age.Value);
            if (cls is { AttendanceLimitOverride: true })
                return (cls.AttendanceLimitType, cls.AttendanceLimitCount);
        }
        return Resolve(groupOverride, groupType, groupCount, generalSettingsJson);
    }

    public static bool IsActive(string? type, int count)
        => count > 0 && !string.IsNullOrWhiteSpace(type) && type != "unlimited";

    public static string? Text(string? type, int count)
    {
        if (!IsActive(type, count)) return null;
        var period = type switch
        {
            "daily" => "Günde",
            "weekly" => "Haftada",
            "monthly" => "Ayda",
            "yearly" => "Yılda",
            _ => null,
        };
        return period is null ? null : $"{period} {count} kez katılabilirsiniz";
    }

    private static (string, int) ParseGeneral(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return ("unlimited", 0);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            if (r.ValueKind != JsonValueKind.Object) return ("unlimited", 0);
            if (r.TryGetProperty("attendanceLimitEnabled", out var en) && en.ValueKind == JsonValueKind.False)
                return ("unlimited", 0);
            var type = r.TryGetProperty("attendanceLimitType", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : "unlimited";
            var count = r.TryGetProperty("attendanceLimitCount", out var c) && c.ValueKind == JsonValueKind.Number && c.TryGetInt32(out var ci) ? ci : 0;
            return (type ?? "unlimited", count);
        }
        catch { return ("unlimited", 0); }
    }

    public static (DateTime Start, DateTime End)? Window(string type, DateTime reference, int monthlyResetDay = 1)
    {
        var d = reference.Date;
        return type switch
        {
            "daily" => (d, d.AddDays(1)),
            "weekly" => (StartOfWeek(d), StartOfWeek(d).AddDays(7)),
            "monthly" => MonthlyWindow(d, monthlyResetDay),
            "yearly" => (new DateTime(d.Year, 1, 1), new DateTime(d.Year + 1, 1, 1)),
            _ => null,
        };
    }

    private static (DateTime, DateTime) MonthlyWindow(DateTime d, int resetDay)
    {
        var day = Math.Clamp(resetDay, 1, 28);
        var anchor = new DateTime(d.Year, d.Month, day);
        var start = d.Day >= day ? anchor : anchor.AddMonths(-1);
        return (start, start.AddMonths(1));
    }

    public static int MonthlyResetDay(string? generalSettingsJson)
    {
        if (string.IsNullOrWhiteSpace(generalSettingsJson)) return 1;
        try
        {
            using var doc = JsonDocument.Parse(generalSettingsJson);
            var r = doc.RootElement;
            if (r.ValueKind == JsonValueKind.Object
                && r.TryGetProperty("attendanceLimitResetDay", out var rd)
                && rd.ValueKind == JsonValueKind.Number && rd.TryGetInt32(out var v))
                return Math.Clamp(v, 1, 28);
        }
        catch { return 1; }
        return 1;
    }

    private static DateTime StartOfWeek(DateTime d)
    {
        var diff = ((int)d.DayOfWeek + 6) % 7;
        return d.AddDays(-diff);
    }
}
