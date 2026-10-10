using Nexora.Infrastructure.Services.Seda;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class SedaConcurrencyTests
{
    [Fact]
    public void TcknLockKey_ayni_tckn_icin_ayni_anahtari_uretir()
    {
        Assert.Equal(SedaConcurrency.TcknLockKey("12345678901"), SedaConcurrency.TcknLockKey("12345678901"));
    }

    [Fact]
    public void TcknLockKey_bosluk_normalizasyonu_ile_ayni_kalir()
    {
        Assert.Equal(SedaConcurrency.TcknLockKey("12345678901"), SedaConcurrency.TcknLockKey("  12345678901  "));
    }

    [Fact]
    public void TcknLockKey_farkli_tckn_icin_farkli_anahtar()
    {
        Assert.NotEqual(SedaConcurrency.TcknLockKey("12345678901"), SedaConcurrency.TcknLockKey("10987654321"));
    }

    [Fact]
    public void PeriodLockKey_ayni_donem_icin_ayni_anahtar_farkli_donem_icin_farkli()
    {
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();
        Assert.Equal(SedaConcurrency.PeriodLockKey(p1), SedaConcurrency.PeriodLockKey(p1));
        Assert.NotEqual(SedaConcurrency.PeriodLockKey(p1), SedaConcurrency.PeriodLockKey(p2));
    }

    [Fact]
    public void IsTcknUniqueViolation_alakasiz_hatada_false()
    {
        Assert.False(SedaConcurrency.IsTcknUniqueViolation(new InvalidOperationException("boom")));
    }
}
