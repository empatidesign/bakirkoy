using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

public static class FacilityScheduleHelper
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public static readonly IReadOnlyDictionary<string, DayOfWeek> DayMap = new Dictionary<string, DayOfWeek>(StringComparer.OrdinalIgnoreCase)
    {
        ["monday"] = DayOfWeek.Monday, ["mon"] = DayOfWeek.Monday, ["pazartesi"] = DayOfWeek.Monday, ["pzt"] = DayOfWeek.Monday, ["1"] = DayOfWeek.Monday,
        ["tuesday"] = DayOfWeek.Tuesday, ["tue"] = DayOfWeek.Tuesday, ["salı"] = DayOfWeek.Tuesday, ["sali"] = DayOfWeek.Tuesday, ["sal"] = DayOfWeek.Tuesday, ["2"] = DayOfWeek.Tuesday,
        ["wednesday"] = DayOfWeek.Wednesday, ["wed"] = DayOfWeek.Wednesday, ["çarşamba"] = DayOfWeek.Wednesday, ["carsamba"] = DayOfWeek.Wednesday, ["çar"] = DayOfWeek.Wednesday, ["car"] = DayOfWeek.Wednesday, ["3"] = DayOfWeek.Wednesday,
        ["thursday"] = DayOfWeek.Thursday, ["thu"] = DayOfWeek.Thursday, ["perşembe"] = DayOfWeek.Thursday, ["persembe"] = DayOfWeek.Thursday, ["per"] = DayOfWeek.Thursday, ["4"] = DayOfWeek.Thursday,
        ["friday"] = DayOfWeek.Friday, ["fri"] = DayOfWeek.Friday, ["cuma"] = DayOfWeek.Friday, ["cum"] = DayOfWeek.Friday, ["5"] = DayOfWeek.Friday,
        ["saturday"] = DayOfWeek.Saturday, ["sat"] = DayOfWeek.Saturday, ["cumartesi"] = DayOfWeek.Saturday, ["cmt"] = DayOfWeek.Saturday, ["6"] = DayOfWeek.Saturday,
        ["sunday"] = DayOfWeek.Sunday, ["sun"] = DayOfWeek.Sunday, ["pazar"] = DayOfWeek.Sunday, ["paz"] = DayOfWeek.Sunday, ["0"] = DayOfWeek.Sunday, ["7"] = DayOfWeek.Sunday,
    };

    public record ScheduleSlot(string? Day, string? StartTime, string? EndTime);

    public static List<ScheduleSlot> ParseSlots(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                var slots = root.EnumerateObject()
                    .Where(p => string.Equals(p.Name, "slots", StringComparison.OrdinalIgnoreCase))
                    .Select(p => p.Value)
                    .FirstOrDefault();
                if (slots.ValueKind != JsonValueKind.Array) return [];
                root = slots;
            }
            if (root.ValueKind != JsonValueKind.Array) return [];
            return root.Deserialize<List<ScheduleSlot>>(JsonOpts) ?? [];
        }
        catch { return []; }
    }

    public static HashSet<DayOfWeek> ParseDays(string json)
    {
        var days = new HashSet<DayOfWeek>();
        foreach (var slot in ParseSlots(json))
        {
            if (!string.IsNullOrWhiteSpace(slot.Day) && DayMap.TryGetValue(slot.Day.Trim(), out var dow))
                days.Add(dow);
        }
        return days;
    }

    public static bool PeriodsOverlap(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd)
        => aStart.Date <= bEnd.Date && bStart.Date <= aEnd.Date;

    /// <summary>
    /// True if any slot in <paramref name="aJson"/> shares both the same day of week AND an overlapping
    /// time-of-day range with any slot in <paramref name="bJson"/>. Unlike day-only comparison, two
    /// schedules on the same weekday but at non-overlapping hours (e.g. 09:00-10:00 vs 20:00-21:00)
    /// are correctly treated as non-conflicting.
    /// </summary>
    public static bool SlotsOverlap(string aJson, string bJson)
        => FindOverlap(aJson, bJson) is not null;

    /// <summary>
    /// Çakışan ilk dilimi (gün + karşı tarafın saat aralığı) döner; çakışma yoksa null.
    /// Kullanıcıya "ne zaman" bilgisini gösterebilmek için SlotsOverlap'ın ayrıntılı sürümü.
    /// </summary>
    public static OverlapInfo? FindOverlap(string aJson, string bJson)
    {
        var aSlots = ParseSlots(aJson);
        var bSlots = ParseSlots(bJson);
        foreach (var a in aSlots)
        {
            if (string.IsNullOrWhiteSpace(a.Day) || !DayMap.TryGetValue(a.Day.Trim(), out var aDay)) continue;
            if (!TryParseTime(a.StartTime, out var aStart) || !TryParseTime(a.EndTime, out var aEnd)) continue;
            foreach (var b in bSlots)
            {
                if (string.IsNullOrWhiteSpace(b.Day) || !DayMap.TryGetValue(b.Day.Trim(), out var bDay)) continue;
                if (aDay != bDay) continue;
                if (!TryParseTime(b.StartTime, out var bStart) || !TryParseTime(b.EndTime, out var bEnd)) continue;
                if (aStart < bEnd && bStart < aEnd)
                    return new OverlapInfo(bDay, bStart, bEnd);
            }
        }
        return null;
    }

    public record OverlapInfo(DayOfWeek Day, TimeSpan Start, TimeSpan End)
    {
        public string DayName => TurkishDayNames[Day];

        /// <summary>"Pazar 10:00-11:00" biçiminde okunabilir metin.</summary>
        public string Describe() => $"{DayName} {Start:hh\\:mm}-{End:hh\\:mm}";
    }

    private static readonly IReadOnlyDictionary<DayOfWeek, string> TurkishDayNames = new Dictionary<DayOfWeek, string>
    {
        [DayOfWeek.Monday] = "Pazartesi", [DayOfWeek.Tuesday] = "Salı", [DayOfWeek.Wednesday] = "Çarşamba",
        [DayOfWeek.Thursday] = "Perşembe", [DayOfWeek.Friday] = "Cuma", [DayOfWeek.Saturday] = "Cumartesi",
        [DayOfWeek.Sunday] = "Pazar",
    };

    private static bool TryParseTime(string? t, out TimeSpan time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(t)) return false;
        return TimeSpan.TryParse(t, out time);
    }
}
