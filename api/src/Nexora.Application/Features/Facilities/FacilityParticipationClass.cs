using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

/// <summary>
/// basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Genel Ayarlar > Katılım
/// Sınıfları" ekranı (yaş aralığına göre ikamet/sağlık raporu/veli onayı/katılım-limiti-override
/// tanımlayan bir liste) tamamen kaydediliyordu ama başvuru sırasında hiçbir yerde okunmadığı için
/// fiilen ölü bir özellikti. Bu sınıf, GeneralSettings.SettingsJson içindeki "participationClasses"
/// dizisini parse edip, verilen yaşa uyan AKTİF sınıfı bulur.
///
/// Ücret muafiyeti/indirimi (feeExempt/feeDiscountPercent) kasıtlı olarak buraya dahil EDİLMEDİ —
/// sistemde hiçbir gerçek ödeme/tahsilat akışı yok (FeeJson sadece bilgilendirici metin üretiyor,
/// bkz. ParticipantFacilityService.BuildFeeText), o yüzden "muafiyet" uygulanacak bir işlem
/// mevcut değil. Sadece gerçek enforcement noktası olan alanlar bağlandı: ikamet şartı, sağlık
/// raporu şartı, veli onayı şartı, katılım sınırı override.
/// </summary>
public static class FacilityParticipationClass
{
    public sealed record ClassRule(
        string Label,
        bool RequiresResidence,
        bool RequiresHealthReport,
        bool RequiresParentalConsent,
        bool AttendanceLimitOverride,
        string AttendanceLimitType,
        int AttendanceLimitCount);

    public static ClassRule? ResolveForAge(string? generalSettingsJson, int age)
    {
        if (string.IsNullOrWhiteSpace(generalSettingsJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(generalSettingsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (!doc.RootElement.TryGetProperty("participationClasses", out var arr) || arr.ValueKind != JsonValueKind.Array)
                return null;

            foreach (var el in arr.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;
                var isActive = !el.TryGetProperty("isActive", out var ia) || ia.ValueKind != JsonValueKind.False;
                if (!isActive) continue;

                var minAge = el.TryGetProperty("minAge", out var mn) && mn.ValueKind == JsonValueKind.Number && mn.TryGetInt32(out var mnv) ? mnv : 0;
                var maxAge = el.TryGetProperty("maxAge", out var mx) && mx.ValueKind == JsonValueKind.Number && mx.TryGetInt32(out var mxv) ? mxv : 999;
                if (age < minAge || age > maxAge) continue;

                var label = el.TryGetProperty("label", out var lb) && lb.ValueKind == JsonValueKind.String ? lb.GetString() ?? "" : "";
                var requiresResidence = el.TryGetProperty("requiresResidence", out var rr) && rr.ValueKind == JsonValueKind.True;
                var requiresHealth = el.TryGetProperty("requiresHealthReport", out var rh) && rh.ValueKind == JsonValueKind.True;
                var requiresParental = el.TryGetProperty("requiresParentalConsent", out var rp) && rp.ValueKind == JsonValueKind.True;
                var limitOverride = el.TryGetProperty("attendanceLimitOverride", out var lo) && lo.ValueKind == JsonValueKind.True;
                var limitType = el.TryGetProperty("attendanceLimitType", out var lt) && lt.ValueKind == JsonValueKind.String ? lt.GetString() ?? "unlimited" : "unlimited";
                var limitCount = el.TryGetProperty("attendanceLimitCount", out var lc) && lc.ValueKind == JsonValueKind.Number && lc.TryGetInt32(out var lcv) ? lcv : 0;

                return new ClassRule(label, requiresResidence, requiresHealth, requiresParental, limitOverride, limitType, limitCount);
            }
            return null;
        }
        catch { return null; }
    }
}
