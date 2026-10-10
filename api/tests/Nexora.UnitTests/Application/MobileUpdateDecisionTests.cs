using Nexora.Application.Features.MobileConfig;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Application;

public class MobileUpdateDecisionTests
{
    [Theory]
    [InlineData("1.0.0", "1.0.3", "1.0.4")]
    [InlineData("0.9.9", "1.0.0", "1.0.0")]
    [InlineData("1.0.2", "1.0.3", null)]
    public void ClientBelowMinVersion_ForcesUpdate(string client, string min, string? latest)
        => Assert.Equal(MobileUpdateStatus.ForceUpdate, MobileUpdateDecision.Evaluate(client, min, latest));

    [Theory]
    [InlineData("1.0.3", "1.0.3", "1.0.4")]
    [InlineData("1.0.0", null, "1.0.4")]
    public void ClientBelowLatestButNotBelowMin_SuggestsUpdate(string client, string? min, string latest)
        => Assert.Equal(MobileUpdateStatus.OptionalUpdate, MobileUpdateDecision.Evaluate(client, min, latest));

    [Theory]
    [InlineData("1.0.4", "1.0.0", "1.0.4")]
    [InlineData("2.0.0", "1.0.0", "1.0.4")]
    public void ClientAtOrAboveLatest_IsUpToDate(string client, string min, string latest)
        => Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate(client, min, latest));

    /// <summary>
    /// Sürümü tam olarak zorunlu sürüme eşit olan kullanıcı güncellemeye
    /// zorlanmamalı: kural "bu sürümün ALTINDAKİLER" der.
    /// </summary>
    [Fact]
    public void ClientExactlyAtMinVersion_IsNotForced()
        => Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate("1.0.3", "1.0.3", null));

    [Fact]
    public void NoRulesConfigured_IsUpToDate()
        => Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate("1.0.0", null, null));

    /// <summary>
    /// Ayrıştırılamayan istemci sürümü kilitlenmeye yol açmamalı — aksi halde
    /// sunucunun tanımadığı her istemci tümüyle kullanılamaz olurdu.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("1.0.0.0.1")]
    public void UnparseableClientVersion_IsNeverForced(string? client)
        => Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate(client, "9.9.9", "9.9.9"));

    /// <summary>Bozuk kural (ör. panelde elle girilmiş çöp) kullanıcıyı kilitlememeli.</summary>
    [Fact]
    public void UnparseableRuleVersion_IsIgnored()
        => Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate("1.0.0", "bozuk", "bozuk"));

    [Fact]
    public void VersionPrefixAndBuildSegmentsAreTolerated()
    {
        Assert.Equal(MobileUpdateStatus.ForceUpdate, MobileUpdateDecision.Evaluate("v1.0.0", "1.0.3", null));
        Assert.Equal(MobileUpdateStatus.UpToDate, MobileUpdateDecision.Evaluate("1.0.4.7", "1.0.3", "1.0.4"));
    }
}
