using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class ShiftCutoffTests
{
    private static DateTime Utc(int d, int h, int m = 0) => new(2026, 9, d, h, m, 0, DateTimeKind.Utc);

    [Fact]
    public void Gunduz_baslayan_mesai_ayni_gun_23te_kapanir()
    {
        // 25.09 09:00 TR = 06:00 UTC → kesim 25.09 23:00 TR = 20:00 UTC
        Assert.Equal(Utc(25, 20), ShiftCutoff.CutoffUtcFor(Utc(25, 6), 180, 23, 0));
    }

    [Fact]
    public void Gece_yarisindan_sonra_TR_saatiyle_baslayan_mesai_o_gunun_23une_baglanir()
    {
        // 25.09 01:30 TR = 24.09 22:30 UTC → UTC tarihine göre değil, TR gününe göre: 25.09 23:00 TR
        Assert.Equal(Utc(25, 20), ShiftCutoff.CutoffUtcFor(Utc(24, 22, 30), 180, 23, 0));
    }

    [Fact]
    public void Kesimden_sonra_baslayan_mesai_ertesi_gunun_kesimine_baglanir()
    {
        // 25.09 23:10 TR = 20:10 UTC → 26.09 23:00 TR
        Assert.Equal(Utc(26, 20), ShiftCutoff.CutoffUtcFor(Utc(25, 20, 10), 180, 23, 0));
    }

    [Fact]
    public void Kacirilmis_kesim_sonraki_gun_tespit_edilir()
    {
        var start = Utc(24, 6);        // 24.09 09:00 TR
        var now = Utc(25, 7);          // 25.09 10:00 TR (sunucu 23:00'te kapalıydı)
        var cutoff = ShiftCutoff.CutoffUtcFor(start, 180, 23, 0);
        Assert.True(cutoff <= now);
        Assert.Equal(Utc(24, 20), cutoff); // başladığı günün 23:00'ü, "şimdi" değil
    }

    [Theory]
    [InlineData(22, 59, false)]
    [InlineData(23, 0, true)]
    [InlineData(2, 0, true)]
    [InlineData(5, 59, true)]
    [InlineData(6, 0, false)]
    [InlineData(12, 0, false)]
    public void Kendi_mesai_baslatma_gece_penceresinde_kapali(int h, int m, bool closed)
    {
        Assert.Equal(closed, ShiftCutoff.IsInClosedWindow(new DateTime(2026, 9, 25, h, m, 0), 23, 0, 6));
    }
}
