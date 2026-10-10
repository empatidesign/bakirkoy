using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

/// <summary>
/// RegistrationWindow sözleşmesi (bkz. RegistrationWindow XML dokümantasyonu, düzeltme
/// 2026-08-26):
///  - <c>now</c>  : TurkeyTime.NowWallClock()'tan gelen GERÇEK Türkiye yerel saati.
///  - <c>start</c>/<c>end</c> : Travel entity alanları — DB round-trip sonrası Kind
///    kaybolsa da ham değer GERÇEKTEN bir UTC an'dır.
///
/// Bu testler önceden iki parametreyi de aynı zaman diliminde varsayıyordu; sözleşme
/// değişince (P0 timezone düzeltmesi) beklentileri geçersiz kaldı. Artık testler
/// sözleşmeyi birebir kuruyor: TR yerel saatler <see cref="Tr"/>, entity alanları ise
/// <see cref="Utc"/> ile üretilir. Böylece test, üretimdeki gerçek çağrı biçimini
/// yansıtır (TR = UTC+3).
/// </summary>
public class RegistrationWindowTests
{
    /// <summary>Türkiye duvar saati (now parametresi için) — Kind=Unspecified.</summary>
    private static DateTime Tr(int year, int month, int day, int hour = 0, int minute = 0, int second = 0)
        => new(year, month, day, hour, minute, second, DateTimeKind.Unspecified);

    /// <summary>Entity alanı (start/end için): verilen TR saatinin UTC karşılığı.</summary>
    private static DateTime Utc(int year, int month, int day, int hour = 0, int minute = 0, int second = 0)
        => TurkeyTime.ToUtc(new DateTime(year, month, day, hour, minute, second, DateTimeKind.Unspecified));

    [Fact]
    public void IsOpen_baslangic_gunu_saat_00_00_ise_acik()
    {
        var start = Utc(2026, 7, 27);
        var end = Utc(2026, 7, 28);

        Assert.True(RegistrationWindow.IsOpen(Tr(2026, 7, 27, 0, 0, 1), start, end));
    }

    [Fact]
    public void IsOpen_baslangictan_once_kapali()
    {
        var start = Utc(2026, 7, 27);
        var end = Utc(2026, 7, 28);

        Assert.False(RegistrationWindow.IsOpen(Tr(2026, 7, 26, 23, 59, 59), start, end));
    }

    [Fact]
    public void IsOpen_bitis_gunu_saat_00_00_ise_o_gunun_sonuna_kadar_acik()
    {
        // Bitiş tarihinde saat girilmemişse (TR 00:00), geriye dönük uyumluluk için
        // o günün SONUNA kadar (bir sonraki güne kadar) açık kabul edilir.
        var start = Utc(2026, 7, 27);
        var end = Utc(2026, 7, 28);

        Assert.True(RegistrationWindow.IsOpen(Tr(2026, 7, 28, 23, 30), start, end));
    }

    [Fact]
    public void IsOpen_bitis_gunu_gectikten_sonra_kapali()
    {
        var start = Utc(2026, 7, 27);
        var end = Utc(2026, 7, 28);

        Assert.False(RegistrationWindow.IsOpen(Tr(2026, 7, 29, 0, 0, 1), start, end));
    }

    [Fact]
    public void IsOpen_bitiste_saat_belirtilmisse_tam_o_saatte_kapanir()
    {
        var start = Utc(2026, 7, 27);
        var end = Utc(2026, 7, 27, 18);

        Assert.True(RegistrationWindow.IsOpen(Tr(2026, 7, 27, 17, 59, 59), start, end));
        Assert.False(RegistrationWindow.IsOpen(Tr(2026, 7, 27, 18), start, end));
    }

    [Fact]
    public void HasStarted_dogru_calisir()
    {
        var start = Utc(2026, 7, 27, 9);

        Assert.False(RegistrationWindow.HasStarted(Tr(2026, 7, 27, 8, 59, 59), start));
        Assert.True(RegistrationWindow.HasStarted(Tr(2026, 7, 27, 9), start));
    }

    [Fact]
    public void HasEnded_saat_00_00_ise_gunun_sonuna_kadar_bitmis_sayilmaz()
    {
        var end = Utc(2026, 7, 28);

        // Bitiş günü içinde (TR 23:00) hâlâ bitmiş sayılmaz.
        Assert.False(RegistrationWindow.HasEnded(Tr(2026, 7, 28, 23), end));
        // Ertesi gün başlayınca bitmiş sayılır.
        Assert.True(RegistrationWindow.HasEnded(Tr(2026, 7, 29, 0, 0, 1), end));
    }
}
