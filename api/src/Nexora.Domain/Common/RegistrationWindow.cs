namespace Nexora.Domain.Common;

/// <summary>
/// Kayıt başlangıç/bitiş penceresi (Travel.RegistrationStartDate/EndDate gibi) için
/// tek noktadan açık/kapalı hesaplaması. Saat bileşeni girilmemiş (00:00) bitiş
/// tarihleri geriye dönük uyumluluk için "o günün SONUNA kadar açık" olarak
/// yorumlanır (eski .Date-bazlı karşılaştırmanın davranışı); saat bileşeni
/// girilmişse (ör. 18:00) kayıt tam o saatte kapanır.
///
/// DÜZELTME (2026-08-26, KAPSAMLI SİSTEM TESTİ, madde TRV-02/REG-01 — P0 regresyon,
/// ÜÇÜNCÜ ve NİHAİ katman — önceki iki "düzeltme" de yanlış çıktı, ayrıntı aşağıda):
///
/// TÜM ÇAĞIRANLAR (ParticipantTravelService, TravelApplicationService) bu API'yi hep
/// aynı iki parametre kaynağıyla çağırıyor:
///   - `now`: HER ZAMAN `TurkeyTime.NowWallClock()` — Kind=Unspecified, GERÇEKTEN
///     Türkiye duvar saati (ör. 23:55).
///   - `start`/`end`: HER ZAMAN bir `Travel` entity alanı (RegistrationStartDate/
///     EndDate) — entity ilk oluşturulduğunda `DateTime.SpecifyKind(..., Utc)` ile
///     açıkça UTC işaretlenir, ANCAK DB round-trip sonrası (`Npgsql.
///     EnableLegacyTimestampBehavior=true` ile `timestamp without time zone` sütun
///     tipinden okunduğunda) EF Core bu alanı **Kind=Unspecified** olarak materialize
///     eder — ham sayı DEĞİŞMEZ (gerçek bir UTC an olarak kalır), yalnızca .NET'in
///     Kind etiketi kaybolur. CANLI KANIT (debug log ile doğrulandı): DB'de saklanan
///     `21:00:00` (TR 27 Ağustos 00:00'ın UTC karşılığı) entity'den okunduğunda
///     `Kind=Unspecified` olarak geliyordu.
///
/// Önceki "düzeltme" (`NormalizeToUtc`), `Kind=Unspecified` gelen HER DEĞERİ "offset'siz
/// Türkiye yerel saat" varsayıp `TurkeyTime.ToUtc()` ile bir kez daha UTC'ye çeviriyordu.
/// `now` parametresi için bu varsayım DOĞRUYDU (gerçekten TR yerel saat). Ama `start`/
/// `end` (entity alanları) için bu varsayım YANLIŞTI: DB'den gelen Unspecified değer
/// zaten gerçek bir UTC an'dı, "TR yerel saat" değildi — `ToUtc` ile tekrar çevrilince
/// ÇİFTE 3 saatlik offset hatası oluşuyordu (21:00 "TR yerel" sanılıp 18:00 UTC'ye
/// çevriliyordu; oysa 21:00 zaten doğru UTC değeriydi). CANLI KANIT: registrationEndDate
/// ertesi güne ayarlı bir gezide, aynı gün saat 23:55 TR'de yapılan başvuru hâlâ
/// "süresi sona ermiştir" ile reddediliyordu (debug log: now=23:55 Unspecified,
/// end=21:00 Unspecified, ikisi de yanlışlıkla "TR yerel" sayılıp normalize edildiğinde
/// end < now çıkıyordu).
///
/// NİHAİ ÇÖZÜM: `now` ve `start`/`end` parametreleri farklı anlamlara sahip olduğundan
/// aynı `NormalizeToUtc` fonksiyonuyla simetrik ele alınamaz. `now` gerçekten TR yerel
/// saattir → `ToUtc` ile çevrilir. `start`/`end` (entity alanları) DB'den Unspecified
/// gelse bile GERÇEKTEN UTC bir andır → yalnızca `DateTime.SpecifyKind(value, Utc)`
/// ile Kind etiketi düzeltilir, DEĞER DÖNÜŞTÜRÜLMEZ.
/// </summary>
public static class RegistrationWindow
{
    /// <summary>`now` parametresi için: `TurkeyTime.NowWallClock()`'tan gelen GERÇEK
    /// Türkiye yerel saatini UTC'ye çevirir.</summary>
    private static DateTime NormalizeNowToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => TurkeyTime.ToUtc(value),
    };

    /// <summary>`start`/`end` parametreleri için: bir `Travel` entity alanından gelen
    /// değer. DB round-trip sonrası Kind kaybolmuş olsa da (Npgsql legacy timestamp
    /// davranışı), ham sayı GERÇEKTEN bir UTC an'dır — yalnızca Kind etiketi düzeltilir,
    /// TurkeyTime.ToUtc ile DEĞER dönüştürülmez (aksi hâlde çifte offset hatası oluşur).</summary>
    private static DateTime NormalizeEntityFieldToUtc(DateTime value)
        => value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    /// <summary>`value`'nun (bir entity alanı) TR yerel saatte tam gece yarısı
    /// (saat girilmemiş) olup olmadığını test eder.</summary>
    private static bool IsMidnightInTurkey(DateTime entityField)
        => TurkeyTime.ToTurkey(NormalizeEntityFieldToUtc(entityField)).TimeOfDay == TimeSpan.Zero;

    public static bool IsOpen(DateTime now, DateTime start, DateTime end)
    {
        var effectiveEnd = IsMidnightInTurkey(end)
            ? TurkeyTime.ToUtc(TurkeyTime.ToTurkey(NormalizeEntityFieldToUtc(end)).Date.AddDays(1))
            : NormalizeEntityFieldToUtc(end);
        var n = NormalizeNowToUtc(now);
        return n >= NormalizeEntityFieldToUtc(start) && n < effectiveEnd;
    }

    public static bool HasStarted(DateTime now, DateTime start)
        => NormalizeNowToUtc(now) >= NormalizeEntityFieldToUtc(start);

    public static bool HasEnded(DateTime now, DateTime end)
    {
        var effectiveEnd = IsMidnightInTurkey(end)
            ? TurkeyTime.ToUtc(TurkeyTime.ToTurkey(NormalizeEntityFieldToUtc(end)).Date.AddDays(1))
            : NormalizeEntityFieldToUtc(end);
        return NormalizeNowToUtc(now) >= effectiveEnd;
    }
}
