namespace Nexora.Domain.Common;

/// <summary>
/// Etkinlik (Event) katılım sıklığı sınırının hangi dönem/adet ile uygulanacağına tek
/// noktadan karar verir. Etkinliğin kendi ayarı önceliklidir; boş bırakılmışsa ("none"
/// veya limit &lt;= 0) etkinlik ayarlarındaki sistem geneli varsayılana düşer.
///
/// Denetim bulgusu (2026-09-17): EventSettings.Participation.DefaultLimitPeriod/Count
/// alanları tanımlı ve admin panelinde sunuluyordu ama hiçbir servis okumuyordu — yalnızca
/// gezi tarafı varsayılana düşüyordu. Sonuç: etkinlik oluştururken limit alanı boş
/// bırakıldığında (canlıda 243 etkinliğin 109'u) operatör "varsayılanı haftada 1 yaptım"
/// sansa da hiçbir kural uygulanmıyor, kişi sınırsız başvurabiliyordu.
///
/// "unlimited" dönem türü bilinçli muafiyettir: varsayılana DÜŞMEZ, sınır hiç uygulanmaz.
/// </summary>
public static class EventParticipationLimitRules
{
    public static bool IsExempt(string participationPeriod)
        => participationPeriod == "unlimited";

    /// <summary>
    /// Etkinliğin kendi ayarı tek başına yeterli mi? Yeterliyse çağıran tarafın sistem
    /// ayarlarını hiç okumasına gerek yoktur (gereksiz I/O ve ayar servisi bağımlılığı).
    /// </summary>
    public static bool IsSelfSufficient(string participationPeriod, int participationLimit)
        => IsExempt(participationPeriod)
           || (!string.IsNullOrWhiteSpace(participationPeriod)
               && participationPeriod != "none"
               && participationLimit > 0);

    /// <summary>
    /// Etkinliğin kendi dönem/limit ayarı geçerliyse onu, değilse varsayılanı döner.
    /// Enforced=false ise bu etkinlik için sıklık sınırı uygulanmaz.
    /// </summary>
    public static (bool Enforced, string Period, int Limit) Resolve(
        string participationPeriod,
        int participationLimit,
        string defaultPeriod,
        int defaultLimit)
    {
        if (IsExempt(participationPeriod)) return (false, "none", 0);

        var period = participationPeriod;
        var limit = participationLimit;

        if (string.IsNullOrWhiteSpace(period) || period == "none" || limit <= 0)
        {
            // Varsayılan da "unlimited" olabilir: o zaman da sınır uygulanmaz.
            if (IsExempt(defaultPeriod)) return (false, "none", 0);
            period = defaultPeriod;
            limit = defaultLimit;
        }

        if (string.IsNullOrWhiteSpace(period) || period == "none" || limit <= 0)
            return (false, "none", 0);

        return (true, period, limit);
    }
}
