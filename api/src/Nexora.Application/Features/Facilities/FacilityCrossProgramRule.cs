using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

/// <summary>
/// Kullanıcı isteği (2026-10-05, Kadın ve Aile Merkezi): bir kişi bir programa (FacilityBranch,
/// ör. "Aşçılık") HERHANGİ bir tesiste aktif başvurusu/kaydı varken, AYNI programa FARKLI bir
/// tesiste tekrar başvuramamalı — ama aynı veya farklı bir tesisteki FARKLI bir programa
/// (ör. "Pastacılık") serbestçe başvurabilmeli. Ayrıca modül genelinde (tüm programlar/tesisler
/// toplamı) bir takvim yılında en fazla N başvuru hakkı olmalı (varsayılan 2).
///
/// Diğer dinamik kurallar gibi (FacilityParticipationLimit, FacilityYearlyWindow) genel ayarlar
/// (FacilitySettingsRecord, Scope="general") JSON'unda saklanır — admin panelden modül bazında
/// açılıp kapatılabilir, sabit kodlanmış bir kural değildir.
/// </summary>
public static class FacilityCrossProgramRule
{
    public sealed record Rule(
        bool SameBranchCrossFacilityBlocked,
        int YearlyMaxApplicationsTotal,
        bool SameCategoryBlocked = true
    );

    public static Rule Parse(string? generalSettingsJson)
    {
        if (string.IsNullOrWhiteSpace(generalSettingsJson)) return new Rule(false, 0, false);
        try
        {
            using var doc = JsonDocument.Parse(generalSettingsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return new Rule(false, 0, false);
            var root = doc.RootElement;

            var blocked = root.TryGetProperty("crossFacilitySameBranchBlocked", out var b) && b.ValueKind == JsonValueKind.True;
            var sameCategory = !root.TryGetProperty("crossFacilitySameCategoryBlocked", out var sc) || sc.ValueKind != JsonValueKind.False;
            var yearlyMax = root.TryGetProperty("crossFacilityYearlyMaxApplications", out var y)
                && y.ValueKind == JsonValueKind.Number && y.TryGetInt32(out var yv) ? yv : 0;

            return new Rule(blocked, yearlyMax, sameCategory);
        }
        catch { return new Rule(false, 0, false); }
    }
}
