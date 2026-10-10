using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class LibraryShiftDaySplitTests
{
    private static LibraryShift Shift(DateTime startUtc, DateTime endUtc)
    {
        var s = LibraryShift.Start(Guid.NewGuid(), "Test", Guid.NewGuid(), "Kütüphane", "admin", null, null, null, null);
        s.Edit(startUtc, endUtc, null, null, "test");
        return s;
    }

    private static DateTime Utc(int d, int h, int m = 0) => new(2026, 9, d, h, m, 0, DateTimeKind.Utc);

    [Fact]
    public void Ayni_gun_mesai_tek_gune_yazilir()
    {
        // 25.09 09:00–17:00 TR = 06:00–14:00 UTC → 480 dk, 25.09
        var parts = LibraryShiftService.SplitByTurkeyDay(Shift(Utc(25, 6), Utc(25, 14)), DateTime.UtcNow).ToList();
        Assert.Single(parts);
        Assert.Equal(new DateOnly(2026, 9, 25), parts[0].Day);
        Assert.Equal(480, parts[0].Minutes);
    }

    [Fact]
    public void Gece_01de_baslayan_mesai_TR_gunune_yazilir_UTC_gunune_degil()
    {
        // 25.09 01:00–02:00 TR = 24.09 22:00–23:00 UTC → 25.09'a
        var parts = LibraryShiftService.SplitByTurkeyDay(Shift(Utc(24, 22), Utc(24, 23)), DateTime.UtcNow).ToList();
        Assert.Single(parts);
        Assert.Equal(new DateOnly(2026, 9, 25), parts[0].Day);
        Assert.Equal(60, parts[0].Minutes);
    }

    [Fact]
    public void Gece_yarisini_asan_mesai_iki_gune_bolunur_toplam_korunur()
    {
        // 24.09 22:00 TR → 25.09 02:00 TR (= 24.09 19:00 → 23:00 UTC): 120 + 120
        var parts = LibraryShiftService.SplitByTurkeyDay(Shift(Utc(24, 19), Utc(24, 23)), DateTime.UtcNow).ToList();
        Assert.Equal(2, parts.Count);
        Assert.Equal((new DateOnly(2026, 9, 24), 120), parts[0]);
        Assert.Equal((new DateOnly(2026, 9, 25), 120), parts[1]);
        Assert.Equal(240, parts.Sum(p => p.Minutes));
    }
}
