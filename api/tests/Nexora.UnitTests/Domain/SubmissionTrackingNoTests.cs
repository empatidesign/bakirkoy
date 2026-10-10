using System.Text.RegularExpressions;
using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

// ULAK-04: takip numarası tek-kaynaktan; milisaniye damgası + 4 haneli kriptografik son ek ile
// aynı anda üretilen başvurularda TrackingNo unique-index çakışması engellenir.
public class SubmissionTrackingNoTests
{
    [Fact]
    public void Generate_beklenen_bicimde_uretir()
    {
        var value = SubmissionTrackingNo.Generate();

        Assert.Matches(new Regex(@"^SUB-\d{10,}-\d{4}$"), value);
    }

    [Fact]
    public void Generate_farkli_zamanlarda_uretilenler_benzersizdir()
    {
        var first = SubmissionTrackingNo.Generate();
        Thread.Sleep(2);
        var second = SubmissionTrackingNo.Generate();

        Assert.NotEqual(first, second);
    }

    // NOT: Bu üretici çakışmaya DİRENÇLİDİR ama mutlak benzersizlik GARANTİSİ VERMEZ (aynı ms + aynı
    // 4 haneli rastgele son ek nadiren çakışabilir) — bu yüzden burada olasılıksal bir "N üretimde N
    // benzersiz" iddiası test edilmez (flaky olurdu). DB seviyesindeki gerçek garanti (unique index
    // ihlalinde sınırlı yeniden üretim + insert retry) TrackingNoRetryTests ile deterministik doğrulanır.
    [Fact]
    public void Generate_son_ek_4_haneli_sifir_dolgulu()
    {
        for (var i = 0; i < 20; i++)
        {
            var suffix = SubmissionTrackingNo.Generate().Split('-')[^1];
            Assert.Equal(4, suffix.Length);
            Assert.True(suffix.All(char.IsDigit));
        }
    }

    [Fact]
    public void Generate_uzunluk_40_karakter_sinirini_asmaz()
    {
        var value = SubmissionTrackingNo.Generate();

        Assert.True(value.Length <= 40, $"TrackingNo max 40 olmalı ama {value.Length} karakter: {value}");
    }
}
