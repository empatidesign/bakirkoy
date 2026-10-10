using FluentValidation.TestHelper;
using Nexora.Application.Common.Security;
using Nexora.Application.Features.Auth.Dtos;
using Nexora.Application.Features.Auth.Validators;
using Nexora.Infrastructure.Security;
using Xunit;

namespace Nexora.UnitTests.Application;

// Kullanıcı isteği (2026-09-07): admin panelde "şifremi unuttum" akışı yalnız e-posta
// ile değil, telefon numarasıyla da başlatılabilmeli.
public class ForgotPasswordIdentifierTests
{
    private readonly ForgotPasswordRequestValidator forgotValidator = new();

    [Theory]
    [InlineData("admin@sultangazi.bel.tr")]
    [InlineData("05321002006")]
    [InlineData("5321002006")]
    [InlineData("+90 532 100 20 06")]
    [InlineData("0532 100 20 06")]
    public void Eposta_veya_telefon_ile_sifirlama_baslatilabilir(string identifier)
    {
        var result = forgotValidator.TestValidate(new ForgotPasswordRequest(null, identifier));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345")]          // çok kısa, telefon sayılmaz
    [InlineData("gecersiz@")]      // eksik alan adı
    [InlineData("abcdefghij")]     // 10 karakter ama rakam değil
    public void Gecersiz_kimlik_reddedilir(string identifier)
    {
        var result = forgotValidator.TestValidate(new ForgotPasswordRequest(null, identifier));
        Assert.False(result.IsValid);
    }

    // Eski istemciler hâlâ yalnız "email" alanı gönderebilir; kırılmamalı.
    [Fact]
    public void Eski_istemcinin_email_alani_desteklenmeye_devam_eder()
    {
        var result = forgotValidator.TestValidate(new ForgotPasswordRequest("admin@nexora.local"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("admin@nexora.local", true)]
    [InlineData("05321002006", false)]
    public void Kimlik_turu_dogru_ayirt_edilir(string value, bool isEmail)
        => Assert.Equal(isEmail, LoginIdentifier.LooksLikeEmail(value));

    [Fact]
    public void Telefondan_rakamlar_ayiklanir()
        => Assert.Equal("905321002006", LoginIdentifier.DigitsOf("+90 (532) 100-20-06"));

    // Kullanıcı isteği (2026-09-07, 2026-09-21): SMS/e-posta ile gönderilen geçici
    // şifre "çok karmaşık olmasın" — telefondan okunup elle yazılabilmeli. Admin
    // oluşturma ve şifremi-unuttum akışları artık aynı PasswordGenerator'ı kullanır.
    [Fact]
    public void Gecici_sifre_basit_ve_okunakli_uretilir()
    {
        for (var i = 0; i < 200; i++)
        {
            var pwd = PasswordGenerator.Generate(8);

            // Küçük harf/sembol içermemeli: kullanıcı elle yazacak.
            Assert.DoesNotContain(pwd, c => !char.IsUpper(c) && !char.IsDigit(c));
            Assert.Equal(8, pwd.Length);
            // Yine de şifre politikasını sağlamalı (8+ karakter, büyük harf, rakam).
            PasswordPolicy.EnsureValid(pwd);
        }
    }

    [Fact]
    public void Gecici_sifreler_ayni_olmamali()
    {
        var uretilenler = Enumerable.Range(0, 100)
            .Select(_ => PasswordGenerator.Generate(8))
            .ToHashSet();
        Assert.True(uretilenler.Count > 90, $"Yetersiz çeşitlilik: {uretilenler.Count}");
    }

    [Fact]
    public void Mock_modda_sabit_sifre_doner()
        => Assert.Equal(PasswordGenerator.MockPassword, PasswordGenerator.Generate(8, useMock: true));
}
