using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class EventParticipationLimitRulesTests
{
    [Theory]
    // Etkinliğin kendi ayarı geçerliyse varsayılan devreye girmez.
    [InlineData("yearly", 1, "weekly", 5, true, "yearly", 1)]
    [InlineData("monthly", 10, "weekly", 1, true, "monthly", 10)]
    // Asıl düzeltme: limit boş bırakılmışsa ayarlardaki varsayılana düşülür.
    [InlineData("none", 0, "weekly", 1, true, "weekly", 1)]
    [InlineData("", 0, "yearly", 2, true, "yearly", 2)]
    // Dönem dolu ama adet 0 ise de eksik sayılır, varsayılana düşer.
    [InlineData("monthly", 0, "weekly", 3, true, "weekly", 3)]
    // "unlimited" bilinçli muafiyet: varsayılana DÜŞMEZ, sınır uygulanmaz.
    [InlineData("unlimited", 0, "weekly", 1, false, "none", 0)]
    // Varsayılan da tanımsız/sınırsızsa hiçbir sınır uygulanmaz.
    [InlineData("none", 0, "none", 0, false, "none", 0)]
    [InlineData("none", 0, "weekly", 0, false, "none", 0)]
    [InlineData("none", 0, "unlimited", 5, false, "none", 0)]
    public void Resolve_etkinlik_limiti_yoksa_varsayilana_duser(
        string period, int limit, string defPeriod, int defLimit,
        bool expectedEnforced, string expectedPeriod, int expectedLimit)
    {
        var (enforced, resolvedPeriod, resolvedLimit) =
            EventParticipationLimitRules.Resolve(period, limit, defPeriod, defLimit);

        Assert.Equal(expectedEnforced, enforced);
        Assert.Equal(expectedPeriod, resolvedPeriod);
        Assert.Equal(expectedLimit, resolvedLimit);
    }

    [Theory]
    // Kendi ayarı yeterli olanlar: çağıran sistem ayarlarını okumamalı.
    [InlineData("yearly", 1, true)]
    [InlineData("weekly", 2, true)]
    [InlineData("unlimited", 0, true)]
    // Eksik olanlar: varsayılana düşmek için ayar okunmalı.
    [InlineData("none", 0, false)]
    [InlineData("", 0, false)]
    [InlineData("monthly", 0, false)]
    public void IsSelfSufficient_ayar_okumasi_gereken_durumlari_ayirir(
        string period, int limit, bool expected)
    {
        Assert.Equal(expected, EventParticipationLimitRules.IsSelfSufficient(period, limit));
    }
}
