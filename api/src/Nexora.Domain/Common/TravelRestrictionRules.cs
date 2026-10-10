using System.Text.Json;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Common;

public static class TravelRestrictionRules
{
    public const int UnlimitedChildren = 99;

    public static bool RequiresSultangaziResidency(string? restrictionsJson)
        => ReadFlag(restrictionsJson, "sultangaziResidentOnly")
            && !ReadFlag(restrictionsJson, "allowOutsideSultangazi");

    public static string ReadResidencyModeRaw(string? restrictionsJson)
    {
        var raw = ReadString(restrictionsJson, "residencyMode");
        if (!string.IsNullOrWhiteSpace(raw))
            return EligibilityRules.NormalizeResidencyMode(raw);
        return RequiresSultangaziResidency(restrictionsJson) ? "sultangazi_only" : "anyone";
    }

    public static ResidencyMode ReadResidencyMode(string? restrictionsJson)
        => ReadResidencyModeRaw(restrictionsJson) switch
        {
            "sultangazi_only" => ResidencyMode.SultangaziOnly,
            "outside_only" => ResidencyMode.OutsideOnly,
            _ => ResidencyMode.Anyone,
        };

    public static bool DocumentRequired(string? restrictionsJson)
        => ReadFlag(restrictionsJson, "documentRequired");

    public static bool RequiresGuardianConsent(string? restrictionsJson)
        => ReadFlag(restrictionsJson, "requiresGuardianConsent");

    /// <summary>
    /// Bir katılımcının yanında getirebileceği maksimum misafir (varsa diğer aile üyesi
    /// seçimleri dahil) sayısı. Route.restrictions.maxCompanions alanından okunur (alan adı
    /// mevcut ~800 canlı sefer kaydıyla uyum için korunmuştur); ayarlanmamışsa varsayılan 4.
    /// </summary>
    public static int MaxGuests(string? restrictionsJson)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson)) return 4;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("maxCompanions", out var m)
                && m.TryGetInt32(out var n) && n >= 0)
                return n;
        }
        catch { }
        return 4;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde bir katılımcının
    /// yanında çocuk getirebilmesi ayrı bir admin ayarıdır — "Maksimum Refakatçi"
    /// (yetişkin misafir/refakatçi) sayısından bağımsızdır.
    ///
    /// Kullanıcı bulgusu (2026-08-09, canlı denetimde kanıtlandı): alan JSON'da hiç
    /// yoksa (admin formu hiç açıp kaydetmeden önceki eski kayıtlar) varsayılan olarak
    /// false dönüyordu — bu, gerçek production'da 117 aktif geziden 113'ünde çocuk
    /// eklemenin sessizce imkansız olmasına yol açmıştı ("yetişkin çocuğunu tek
    /// rezervasyonda ekleyemiyor" şikayetinin kök nedeni). MaxGuests'teki aynı
    /// desen izlenerek düzeltildi: alan JSON'da hiç yoksa artık true (izin verilir)
    /// kabul edilir; admin toggle'ı bilinçli olarak kapatmışsa (false açıkça
    /// kaydedilmişse) o tercih aynen korunur.
    /// </summary>
    public static bool AllowChildren(string? restrictionsJson)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson) || restrictionsJson == "{}") return true;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return true;
            if (!doc.RootElement.TryGetProperty("allowChildren", out var el)) return true;
            if (el.ValueKind == JsonValueKind.True) return true;
            if (el.ValueKind == JsonValueKind.False) return false;
            if (el.ValueKind == JsonValueKind.String && bool.TryParse(el.GetString(), out var b)) return b;
            return true;
        }
        catch { return true; }
    }

    public static int MaxChildren(string? restrictionsJson)
    {
        var n = ReadInt(restrictionsJson, "maxChildren");
        return n is null or < 0 ? UnlimitedChildren : n.Value;
    }

    /// <summary>Katılabilecek çocuğun minimum yaşı (dahil). Ayarlanmamışsa 0.</summary>
    public static int ChildMinAge(string? restrictionsJson)
    {
        var n = ReadInt(restrictionsJson, "childMinAge");
        return n is null or < 0 ? 0 : n.Value;
    }

    /// <summary>Katılabilecek çocuğun maksimum yaşı (dahil). Ayarlanmamışsa 17 (reşit olmayan üst sınırı).</summary>
    public static int ChildMaxAge(string? restrictionsJson)
    {
        var n = ReadInt(restrictionsJson, "childMaxAge");
        return n is null or < 0 ? 17 : n.Value;
    }

    /// <summary>
    /// Çocuğun cinsiyet şartı: "mixed" (fark etmez, varsayılan), "male" (yalnızca erkek
    /// çocuk), "female" (yalnızca kız çocuk).
    /// </summary>
    public static string ChildGenderMode(string? restrictionsJson)
    {
        var raw = ReadString(restrictionsJson, "childGenderMode");
        return raw is "male" or "female" ? raw : "mixed";
    }

    /// <summary>
    /// Kullanıcı bulgusu (2026-08-09): "Gezi eklerken yetişkin kişi aynı rezervasyonda çocuklarını
    /// ekleyememektedir" — kök neden, tek rezervasyonda seçilebilecek toplam kişi sayısı üst sınırının
    /// (MaxGroupSize) SADECE maxCompanions'tan (yetişkin misafir ayarı, admin varsayılanı 0)
    /// hesaplanmasıydı; allowChildren=true + maxChildren>0 olsa bile hiç dikkate alınmıyordu. Sonuç:
    /// maxCompanions=0 olan (yaygın, çünkü form varsayılanı 0) bir geziye veli "kendim + çocuğum" diye
    /// aynı rezervasyona 2 kişi seçtiğinde hem frontend'deki currentTotal>=maxGroupSize uyarısı hem de
    /// backend'in COMPANION_LIMIT hatası devreye giriyor, oysa çocuk ekleme ayrı bir ayar (allowChildren/
    /// maxChildren) üzerinden zaten açıkça izin verilmiş durumda. "Tek tek rezervasyon" ile (her seferinde
    /// 1 kişi) sorun yaşanmıyordu çünkü her tekil başvuru maxGroupSize=1 sınırını tek başına karşılıyordu.
    /// Düzeltme: grup üst sınırı artık kendisi + izin verilen yetişkin refakatçi + (çocuk katılımı açıksa)
    /// izin verilen çocuk sayısının toplamı.
    /// </summary>
    public static int MaxGroupSize(string? restrictionsJson)
    {
        var self = 1;
        var guests = MaxGuests(restrictionsJson);
        var children = AllowChildren(restrictionsJson) ? MaxChildren(restrictionsJson) : 0;
        return self + guests + children;
    }

    private static int? ReadInt(string? restrictionsJson, string field)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson) || restrictionsJson == "{}") return null;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (!doc.RootElement.TryGetProperty(field, out var el)) return null;
            return el.TryGetInt32(out var n) ? n : null;
        }
        catch { return null; }
    }

    /// <summary>
    /// Kullanıcı bulgusu (2026-08-09): bir çocuk, veli hesabından geçerli şekilde bir geziye
    /// eklendikten (ParticipantTravelService.IsAccompaniableMinor ile kabul edildikten) SONRA,
    /// admin panelde o başvurunun evrak/ödeme durumunu güncellemek (TravelApplicationService.
    /// UpdateAsync) "Bu gezi 18 yaş ve üzeri için açıktır" hatasıyla başarısız oluyordu. Kök
    /// neden: admin tarafındaki EnsureAgeRestriction yalnızca ham travel.MinAge/MaxAge'e
    /// bakıyordu, allowChildren/childMinAge/childMaxAge istisnasından tamamen habersizdi —
    /// oysa bu istisna citizen tarafında zaten IsAccompaniableMinor ile uygulanıyordu. İki
    /// tarafın yaş kuralı birbirinden bağımsız/tutarsızdı: citizen kabul ediyor, admin
    /// reddediyordu. Bu metod, "bir katılımcı gezinin normal yaş aralığına uymasa bile,
    /// çocuk istisnası kapsamında kabul edilebilir mi?" sorusunu tek bir yerden (paylaşılan
    /// domain kuralı) yanıtlar — hem citizen hem admin tarafı artık aynı mantığı kullanır.
    /// </summary>
    public static bool IsEligibleAsAccompaniedChild(string? restrictionsJson, int participantAge, string participantGender)
    {
        if (participantAge >= 18) return false;
        if (!AllowChildren(restrictionsJson)) return false;

        var childMinAge = ChildMinAge(restrictionsJson);
        var childMaxAge = ChildMaxAge(restrictionsJson);
        if (participantAge < childMinAge || participantAge > childMaxAge) return false;

        var childGenderMode = ChildGenderMode(restrictionsJson);
        if (childGenderMode is "male" or "female" && !string.Equals(childGenderMode, participantGender, StringComparison.OrdinalIgnoreCase))
            return false;

        return true;
    }

    public static (DateTime Start, DateTime End) PeriodWindow(string period, DateTime date)
    {
        // V09: gezi tarihi (StartDate) UTC saklanır (TurkeyDateTimeConverter girdiyi Türkiye→UTC çevirir;
        // örn. TR 2027-01-01 00:30 → 2026-12-31T21:30Z). Dönem sınırı Türkiye TAKVİMİNDE kurulmalı,
        // sonra sorgu için UTC'ye çevrilmeli — aksi halde yıl/ay sınırında yanlış pencere seçilir
        // (2027 ilk saati 2026 penceresine düşerdi).
        var d = TurkeyTime.ToTurkey(DateTime.SpecifyKind(date, DateTimeKind.Utc)).Date;
        var (start, end) = period switch
        {
            "daily" => (d, d.AddDays(1)),
            "weekly" => (StartOfWeek(d), StartOfWeek(d).AddDays(7)),
            "monthly" => (new DateTime(d.Year, d.Month, 1), new DateTime(d.Year, d.Month, 1).AddMonths(1)),
            "yearly" => (new DateTime(d.Year, 1, 1), new DateTime(d.Year + 1, 1, 1)),
            _ => (DateTime.MinValue, DateTime.MaxValue),
        };
        if (start == DateTime.MinValue) return (start, end);
        return (TurkeyTime.ToUtc(start), TurkeyTime.ToUtc(end));
    }

    private static DateTime StartOfWeek(DateTime d)
    {
        var diff = ((int)d.DayOfWeek + 6) % 7;
        return d.AddDays(-diff).Date;
    }

    private static string? ReadString(string? restrictionsJson, string field)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson) || restrictionsJson == "{}") return null;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (!doc.RootElement.TryGetProperty(field, out var el)) return null;
            return el.ValueKind == JsonValueKind.String ? el.GetString() : null;
        }
        catch { return null; }
    }

    private static bool ReadFlag(string? restrictionsJson, string field)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson) || restrictionsJson == "{}") return false;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return false;
            if (!doc.RootElement.TryGetProperty(field, out var el)) return false;
            return el.ValueKind == JsonValueKind.True
                || (el.ValueKind == JsonValueKind.String && bool.TryParse(el.GetString(), out var b) && b);
        }
        catch { return false; }
    }
}
