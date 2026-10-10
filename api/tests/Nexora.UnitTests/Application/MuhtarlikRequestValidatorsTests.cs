using FluentValidation.TestHelper;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Application.Features.CitizenSubmissions.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

// Denetim düzeltmesi (2026-09-01): aynı hata sınıfı (2026-08-13/14'te AppMenu/Education'da
// kapatılmıştı) muhtarlık modülünde hiç kapatılmamıştı. ProvisionMuhtarRequest ve
// CreateSubmissionByMuhtarRequest'te hiç FluentValidation validator'ı yoktu; DB kolon
// sınırlarını aşan girdi (FullName/Phone/Email/Title/Description/Address) yakalanmamış
// 500 üretiyordu. Canlı testte kanıtlandı: 500 karakterlik FullName/Phone/Title, 350+
// karakterlik Email hepsi ayrı ayrı 500 döndürdü.
public class MuhtarlikRequestValidatorsTests
{
    private readonly ProvisionMuhtarRequestValidator _provision = new();
    private readonly CreateSubmissionByMuhtarRequestValidator _createByMuhtar = new();

    [Fact]
    public void ProvisionMuhtar_bos_adsoyad_reddedilir()
    {
        var req = new ProvisionMuhtarRequest("", null, null);
        var result = _provision.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void ProvisionMuhtar_200_karakteri_asan_adsoyad_reddedilir()
    {
        var req = new ProvisionMuhtarRequest(new string('A', 201), null, null);
        var result = _provision.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void ProvisionMuhtar_20_karakteri_asan_telefon_reddedilir()
    {
        var req = new ProvisionMuhtarRequest("Test Muhtar", new string('5', 21), null);
        var result = _provision.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Phone);
    }

    [Fact]
    public void ProvisionMuhtar_300_karakteri_asan_email_reddedilir()
    {
        var longEmail = new string('a', 295) + "@test.com";
        var req = new ProvisionMuhtarRequest("Test Muhtar", null, longEmail);
        var result = _provision.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void ProvisionMuhtar_gecersiz_email_formati_reddedilir()
    {
        var req = new ProvisionMuhtarRequest("Test Muhtar", null, "gecersiz-email");
        var result = _provision.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void ProvisionMuhtar_gecerli_veri_kabul_edilir()
    {
        var req = new ProvisionMuhtarRequest("Test Muhtar", "05551112233", "muhtar.test@sultangazi.bel.tr");
        var result = _provision.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ProvisionMuhtar_bos_telefon_email_kabul_edilir()
    {
        var req = new ProvisionMuhtarRequest("Test Muhtar", null, null);
        var result = _provision.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateByMuhtar_bos_baslik_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest("", "açıklama", "other", "request", "normal", "adres", null, null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void CreateByMuhtar_250_karakteri_asan_baslik_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(new string('T', 251), "açıklama", "other", "request", "normal", "adres", null, null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void CreateByMuhtar_2000_karakteri_asan_aciklama_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest("başlık", new string('A', 2001), "other", "request", "normal", "adres", null, null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void CreateByMuhtar_500_karakteri_asan_adres_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest("başlık", "açıklama", "other", "request", "normal", new string('A', 501), null, null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Address);
    }

    [Fact]
    public void CreateByMuhtar_gecersiz_kategori_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest("başlık", "açıklama", "gecersiz-kategori", "request", "normal", "adres", null, null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.CategoryId);
    }

    [Fact]
    public void CreateByMuhtar_gecerli_veri_kabul_edilir()
    {
        var req = new CreateSubmissionByMuhtarRequest("Sokak lambası arızalı", "Üç gündür yanmıyor.", "lighting", "complaint", "high", "Test Mah. 1. Sk.", 41.0, 28.9);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // --- Kullanıcı isteği (2026-09-07): "kişi başkası adına yapılacaksa TC kimlik doğum
    // tarihi girecek" — OnBehalfOf=true olduğunda TC/doğum tarihi zorunlu, Address ise
    // yalnızca AddressType="other" iken zorunlu (residence modunda NVI/kayıtlı adres kullanılır).

    [Fact]
    public void CreateByMuhtar_baskasi_adina_bos_tc_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null,
            OnBehalfOf: true, CitizenTc: "", CitizenBirthDate: new DateTime(1990, 1, 1));
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.CitizenTc);
    }

    [Fact]
    public void CreateByMuhtar_baskasi_adina_11_haneli_olmayan_tc_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null,
            OnBehalfOf: true, CitizenTc: "123", CitizenBirthDate: new DateTime(1990, 1, 1));
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.CitizenTc);
    }

    [Fact]
    public void CreateByMuhtar_baskasi_adina_bos_dogum_tarihi_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null,
            OnBehalfOf: true, CitizenTc: "12345678901", CitizenBirthDate: null);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.CitizenBirthDate);
    }

    [Fact]
    public void CreateByMuhtar_baskasi_adina_farkli_adres_secilip_adres_bos_reddedilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null,
            OnBehalfOf: true, CitizenTc: "12345678901", CitizenBirthDate: new DateTime(1990, 1, 1),
            AddressType: "other");
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Address);
    }

    [Fact]
    public void CreateByMuhtar_baskasi_adina_ikametgah_secilince_adres_bos_olabilir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null,
            OnBehalfOf: true, CitizenTc: "12345678901", CitizenBirthDate: new DateTime(1990, 1, 1),
            AddressType: "residence");
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Address);
    }

    [Fact]
    public void CreateByMuhtar_kendi_adina_adres_zorunlu_kalir()
    {
        var req = new CreateSubmissionByMuhtarRequest(
            "başlık", "açıklama", "other", "request", "normal", "", null, null, OnBehalfOf: false);
        var result = _createByMuhtar.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Address);
    }
}
