using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// REGRESYON — BULGU 2026-10-02 (derinlemesine modül testi, events QR check-in canlı akışı):
// `EventAttendanceService.CombineDateAndTime`, DB'den UTC olarak gelen `date` (ev.StartDate)
// üzerinde eskiden doğrudan `.Date` alıyordu. Bu UTC TAKVİM GÜNÜNÜ döner, TR takvim gününü DEĞİL.
// TR 00:00-02:59 arası başlayan bir etkinlik UTC'de ÖNCEKİ günün 21:00-23:59'una denk geldiğinden,
// `StartTime` (TR saati niyetinde) yanlış güne ekleniyor, hesaplanan gerçek başlangıç ~1 gün geriye
// kayıyordu — yeni oluşturulmuş, "şu an" başlayan bir etkinlikte anında 409 ATTENDANCE_CLOSED
// hatasına yol açıyordu (canlı API testiyle doğrulandı, commit e474931).
//
// Bu test, saat dilimine/sistem saatine bağlı olmayan SABİT tarihlerle, düzeltmeden önceki kodun
// üreteceği (yanlış) sonuç ile düzeltmeden sonraki (doğru) sonucu ayırt eder.
public class EventAttendanceCombineDateAndTimeTests
{
    [Fact]
    public void TrGeceYarisiSiniriIcinGercekGunuDogruHesaplar()
    {
        // TR 2026-10-03 01:00 -> UTC 2026-10-02 22:00 (DB'de UTC olarak böyle saklanır; TR +3 sabit, DST yok).
        // Eski (hatalı) kod: date.Date (= 2026-10-02 00:00, UTC takvim günü) + "01:00" TR'ye çevrilince
        //   2026-10-01 22:00 UTC döner — yani gerçek TR 03 Ekim 01:00'den TAM 1 GÜN ÖNCESİ.
        // Yeni (düzeltilmiş) kod: önce UTC'den TR'ye çevir (2026-10-03 01:00 TR), oradan takvim günü al
        //   (2026-10-03), "01:00" ekle, TR->UTC çevir -> 2026-10-02 22:00 UTC. DOĞRU SONUÇ.
        var utcStartDateFromDb = new DateTime(2026, 10, 2, 22, 0, 0, DateTimeKind.Utc);

        var result = EventAttendanceService.CombineDateAndTime(utcStartDateFromDb, "01:00");

        var expectedUtc = new DateTime(2026, 10, 2, 22, 0, 0, DateTimeKind.Utc);
        Assert.Equal(expectedUtc, result.ToUniversalTime());

        // Eski hatalı davranışın ürettiği (yanlış) sonuçla KARIŞTIRILMADIĞINI doğrula —
        // bu assertion fix geri alınırsa (regresyon) testi gerçekten kırar.
        var oldBuggyResult = new DateTime(2026, 10, 1, 22, 0, 0, DateTimeKind.Utc);
        Assert.NotEqual(oldBuggyResult, result.ToUniversalTime());
    }

    [Fact]
    public void TrSabahSaatindeGunKaymasiOlmaz_Regresyon()
    {
        // Gece yarısı sınırını kesmeyen bir saat (TR 08:00) için davranış değişmemeli.
        // TR 2026-10-03 08:00 -> UTC 2026-10-03 05:00.
        var utcStartDateFromDb = new DateTime(2026, 10, 3, 5, 0, 0, DateTimeKind.Utc);

        var result = EventAttendanceService.CombineDateAndTime(utcStartDateFromDb, "08:00");

        var expectedUtc = new DateTime(2026, 10, 3, 5, 0, 0, DateTimeKind.Utc);
        Assert.Equal(expectedUtc, result.ToUniversalTime());
    }

    [Theory]
    [InlineData("00:30")]
    [InlineData("01:00")]
    [InlineData("02:59")]
    public void GeceYarisindanSonrakiHerSaatIcinDogruGunSecilir(string trStartTime)
    {
        // TR Y-A-G 01:00 civarı her saat için, DB'deki UTC StartDate önceki günün akşamına denk gelir
        // (UTC = TR 00:00 - 3 saat = önceki gün 21:00). Düzeltme bu durumların HEPSİNDE doğru TR
        // takvim gününe dönmelidir — yoksa her biri eski hatayı yeniden üretir.
        var utcMidnightBoundary = new DateTime(2026, 10, 2, 21, 0, 0, DateTimeKind.Utc); // TR 2026-10-03 00:00

        var result = EventAttendanceService.CombineDateAndTime(utcMidnightBoundary, trStartTime);
        var resultTr = TimeZoneInfo.ConvertTimeFromUtc(result.ToUniversalTime(),
            TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"));

        // Doğru TR takvim günü 2026-10-03 olmalı (bir gün önceye kaymamış).
        Assert.Equal(new DateTime(2026, 10, 3), resultTr.Date);
    }
}
