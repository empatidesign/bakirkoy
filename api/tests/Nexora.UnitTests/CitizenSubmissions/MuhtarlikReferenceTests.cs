using Nexora.Application.Features.CitizenSubmissions;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

/// <summary>
/// Bulgu (2026-09-07, kendi kendine gözden geçirme): SlugifyForUsername içinde
/// ToLowerInvariant() Türkçe noktalı büyük İ'yi (U+0130) küçük harfe çevirmiyordu
/// (yalnızca tr-TR kültüründe İ->i olur, invariant'ta İ->İ kalır) — "İsmetpaşa
/// Mahallesi" gibi İ ile başlayan mahalle adlarında üretilen muhtar e-postası
/// büyük harfle başlıyordu (muhtar.İsmetpasa@...). İşlevsel bir hataya yol açmıyordu
/// (e-posta karşılaştırmaları case-insensitive) ama tutarsızdı.
/// </summary>
public class MuhtarlikReferenceTests
{
    [Theory]
    [InlineData("İsmetpaşa Mahallesi", "ismetpasa")]
    [InlineData("50. Yıl Mahallesi", "50-yil")]
    [InlineData("Sultançiftliği Mahallesi", "sultanciftligi")]
    [InlineData("Uğur Mumcu Mahallesi", "ugur-mumcu")]
    [InlineData("Zübeyde Hanım Mahallesi", "zubeyde-hanim")]
    public void SlugifyForUsername_turkce_karakterleri_ve_buyuk_I_dogru_normalize_eder(string neighborhood, string expectedSlug)
    {
        var slug = MuhtarlikReference.SlugifyForUsername(neighborhood);

        Assert.Equal(expectedSlug, slug);
        // E-posta local-part'ı olarak kullanılacağı için tamamen küçük harf olmalı.
        Assert.Equal(slug, slug.ToLowerInvariant());
    }

    [Fact]
    public void SlugifyForUsername_tum_16_mahalle_icin_gecerli_ve_kucuk_harf_slug_uretir()
    {
        foreach (var neighborhood in MuhtarlikReference.Neighborhoods)
        {
            var slug = MuhtarlikReference.SlugifyForUsername(neighborhood);
            Assert.False(string.IsNullOrWhiteSpace(slug), $"'{neighborhood}' için boş slug üretildi.");
            Assert.Equal(slug, slug.ToLowerInvariant());
            Assert.DoesNotContain('İ', slug);
            Assert.DoesNotContain(' ', slug);
        }
    }
}
