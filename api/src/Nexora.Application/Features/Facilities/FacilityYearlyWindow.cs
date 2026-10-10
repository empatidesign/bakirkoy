using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

/// <summary>
/// basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Tesis Özel > Yıllık Katılım
/// Şartları" (tesis bazında override edilebilen, admin UI'nin kendisinin "şu anda sadece
/// kaydediliyor, henüz uygulanmıyor" diye itiraf ettiği bir bölüm) tamamen ölüydü. Bu sınıf,
/// FacilitySettingsRecord (Scope="facility") kaydındaki ScopedSettings JSON'unu parse edip
/// tesis-bazlı yıllık kontenjan penceresini uygular.
/// </summary>
public static class FacilityYearlyWindow
{
    public sealed record Rule(bool Enabled, DateTime? StartDate, DateTime? EndDate, int MaxApplications, int MinAge, int MaxAge);

    public static Rule Parse(string? scopedSettingsJson)
    {
        if (string.IsNullOrWhiteSpace(scopedSettingsJson)) return new Rule(false, null, null, 0, 0, 0);
        try
        {
            using var doc = JsonDocument.Parse(scopedSettingsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return new Rule(false, null, null, 0, 0, 0);
            var root = doc.RootElement;

            var enabled = root.TryGetProperty("yearlyEnabled", out var en) && en.ValueKind == JsonValueKind.True;
            if (!enabled) return new Rule(false, null, null, 0, 0, 0);

            DateTime? start = root.TryGetProperty("yearlyStartDate", out var sd) && sd.ValueKind == JsonValueKind.String
                && DateTime.TryParse(sd.GetString(), out var sdv) ? sdv.Date : null;
            DateTime? end = root.TryGetProperty("yearlyEndDate", out var ed) && ed.ValueKind == JsonValueKind.String
                && DateTime.TryParse(ed.GetString(), out var edv) ? edv.Date : null;
            var maxApp = root.TryGetProperty("yearlyMaxApplications", out var ma) && ma.ValueKind == JsonValueKind.Number && ma.TryGetInt32(out var mav) ? mav : 0;
            var minAge = root.TryGetProperty("yearlyMinAge", out var mn) && mn.ValueKind == JsonValueKind.Number && mn.TryGetInt32(out var mnv) ? mnv : 0;
            var maxAge = root.TryGetProperty("yearlyMaxAge", out var mx) && mx.ValueKind == JsonValueKind.Number && mx.TryGetInt32(out var mxv) ? mxv : 0;

            return new Rule(true, start, end, maxApp, minAge, maxAge);
        }
        catch { return new Rule(false, null, null, 0, 0, 0); }
    }
}
