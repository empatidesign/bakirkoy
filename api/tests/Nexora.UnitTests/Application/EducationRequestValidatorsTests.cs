using FluentValidation.TestHelper;
using Nexora.Application.Features.Education.Requests;
using Nexora.Application.Features.Education.Validators;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Application;

// 2026-08-13/14 denetiminde bulundu: Eğitim Kurumları + eğitim geçmişi (hem admin
// HEM vatandaşın kendi self-service ucu) endpoint'lerinde hiç FluentValidation
// validator'ı yoktu — Name alanı VARCHAR(200) sınırını aşan girdi 500 verirdi,
// StartYear/EndYear üzerinde hiçbir mantık kontrolü yoktu.
public class EducationRequestValidatorsTests
{
    private readonly CreateEducationInstitutionRequestValidator _createInst = new();
    private readonly UpdateEducationInstitutionRequestValidator _updateInst = new();
    private readonly CreateEducationHistoryRequestValidator _createHist = new();
    private readonly UpdateEducationHistoryRequestValidator _updateHist = new();

    [Fact]
    public void CreateInstitution_bos_ad_reddedilir()
    {
        var req = new CreateEducationInstitutionRequest(InstitutionType.Universite, "", null, null, null);
        var result = _createInst.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateInstitution_200_karakteri_asan_ad_reddedilir()
    {
        var req = new CreateEducationInstitutionRequest(InstitutionType.Universite, new string('A', 201), null, null, null);
        var result = _createInst.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateInstitution_gecerli_veri_kabul_edilir()
    {
        var req = new CreateEducationInstitutionRequest(InstitutionType.Universite, "Test Üniversitesi", null, null, DegreeLevel.Lisans);
        var result = _createInst.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateInstitution_200_karakteri_asan_ad_reddedilir()
    {
        var req = new UpdateEducationInstitutionRequest(InstitutionType.Lise, new string('B', 250), null, null, null);
        var result = _updateInst.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateHistory_cok_erken_baslangic_yili_reddedilir()
    {
        var req = new CreateEducationHistoryRequest(null, EducationLevel.Lisans, -5000, null, false);
        var result = _createHist.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.StartYear);
    }

    [Fact]
    public void CreateHistory_bitis_yili_baslangictan_once_reddedilir()
    {
        var req = new CreateEducationHistoryRequest(null, EducationLevel.Lisans, 2020, 2010, true);
        var result = _createHist.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndYear);
    }

    [Fact]
    public void CreateHistory_gecerli_veri_kabul_edilir()
    {
        var req = new CreateEducationHistoryRequest(null, EducationLevel.Lisans, 2015, 2019, true);
        var result = _createHist.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateHistory_devam_eden_egitim_endYear_null_kabul_edilir()
    {
        var req = new CreateEducationHistoryRequest(null, EducationLevel.Lisans, 2023, null, false);
        var result = _createHist.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateHistory_bitis_yili_baslangictan_once_reddedilir()
    {
        var req = new UpdateEducationHistoryRequest(null, EducationLevel.Lisans, 2020, 2005, true);
        var result = _updateHist.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndYear);
    }
}
