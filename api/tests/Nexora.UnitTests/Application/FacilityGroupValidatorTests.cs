using System.Text.Json;
using FluentValidation.TestHelper;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Facilities.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

public class FacilityGroupValidatorTests
{
    private static JsonElement Json(string raw) => JsonDocument.Parse(raw).RootElement;
    private static JsonElement EmptyArray => Json("[]");
    private static JsonElement EmptyObject => Json("{}");

    private static CreateFacilityGroupRequest ValidRequest(
        DateTime? applicationStart = null,
        DateTime? applicationEnd = null,
        JsonElement? schedule = null,
        JsonElement? fee = null,
        string type = "kurs",
        int periodMonths = 3,
        int ageMin = 0,
        int ageMax = 0)
        => new(
            FacilityId: Guid.NewGuid(),
            BranchId: Guid.NewGuid(),
            ParentGroupId: null,
            Name: "Test Grup",
            Description: null,
            Type: type,
            Gender: "mixed",
            Capacity: 20,
            ReserveCapacity: 5,
            AgeMin: ageMin,
            AgeMax: ageMax,
            Schedule: schedule ?? EmptyArray,
            AttendanceMode: "full",
            Fee: fee ?? EmptyObject,
            Conditions: EmptyObject,
            PeriodStart: null,
            PeriodEnd: null,
            PeriodMonths: periodMonths,
            PeriodType: "monthly",
            PeriodCount: 1,
            ApplicationStartDate: applicationStart,
            ApplicationEndDate: applicationEnd,
            AcademyWhitelistEnabled: false,
            AbsenceLimit: 3,
            ConsecutiveAbsenceLimit: 2,
            EntryGraceMinutes: 10,
            InstructorId: null,
            IsActive: true);

    private readonly CreateFacilityGroupRequestValidator _validator = new();

    [Fact]
    public void Gecerli_istek_hata_vermez()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ApplicationStartDate_gecmiste_olsa_bile_gecerlidir()
    {
        var req = ValidRequest(
            applicationStart: DateTime.UtcNow.Date.AddDays(-1),
            applicationEnd: DateTime.UtcNow.Date.AddDays(30));
        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.ApplicationEndDate);
    }

    [Fact]
    public void ApplicationEndDate_gecmiste_ise_reddedilir()
    {
        var req = ValidRequest(
            applicationStart: DateTime.UtcNow.Date.AddDays(-10),
            applicationEnd: DateTime.UtcNow.Date.AddDays(-1));
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ApplicationEndDate!.Value);
    }

    [Fact]
    public void ApplicationEndDate_baslangictan_once_ise_reddedilir()
    {
        var req = ValidRequest(
            applicationStart: DateTime.UtcNow.Date.AddDays(20),
            applicationEnd: DateTime.UtcNow.Date.AddDays(10));
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ApplicationEndDate!.Value);
    }

    [Fact]
    public void Gecersiz_tur_reddedilir()
    {
        var result = _validator.TestValidate(ValidRequest(type: "gecersiz"));
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Akademi_periyot_serbestisi_12_ay_zorunlulugu_yok()
    {
        var sixMonths = _validator.TestValidate(ValidRequest(type: "akademi", periodMonths: 6));
        sixMonths.ShouldNotHaveValidationErrorFor(x => x.PeriodMonths);

        var twelveMonths = _validator.TestValidate(ValidRequest(type: "akademi", periodMonths: 12));
        twelveMonths.ShouldNotHaveValidationErrorFor(x => x.PeriodMonths);
    }

    [Fact]
    public void AgeMin_AgeMax_tan_buyukse_reddedilir()
    {
        var result = _validator.TestValidate(ValidRequest(ageMin: 20, ageMax: 10));
        result.ShouldHaveValidationErrorFor(x => x.AgeMin);
    }

    [Fact]
    public void Schedule_baslangic_bitisten_sonra_ise_reddedilir()
    {
        var schedule = Json("[{\"day\":\"monday\",\"startTime\":\"18:00\",\"endTime\":\"17:00\"}]");
        var result = _validator.TestValidate(ValidRequest(schedule: schedule));
        result.ShouldHaveValidationErrorFor(x => x.Schedule);
    }

    [Fact]
    public void Schedule_gecerli_saat_araligi_kabul_edilir()
    {
        var schedule = Json("[{\"day\":\"monday\",\"startTime\":\"17:00\",\"endTime\":\"18:30\"}]");
        var result = _validator.TestValidate(ValidRequest(schedule: schedule));
        result.ShouldNotHaveValidationErrorFor(x => x.Schedule);
    }

    [Fact]
    public void Schedule_ayni_gun_iki_slot_reddedilir()
    {
        var schedule = Json("[{\"day\":\"monday\",\"startTime\":\"09:00\",\"endTime\":\"10:00\"},{\"day\":\"monday\",\"startTime\":\"14:00\",\"endTime\":\"15:00\"}]");
        var result = _validator.TestValidate(ValidRequest(schedule: schedule));
        result.ShouldHaveValidationErrorFor(x => x.Schedule);
    }

    [Fact]
    public void Schedule_gecersiz_saat_formati_reddedilir()
    {
        var schedule = Json("[{\"day\":\"monday\",\"startTime\":\"9:00\",\"endTime\":\"10:00\"}]");
        var result = _validator.TestValidate(ValidRequest(schedule: schedule));
        result.ShouldHaveValidationErrorFor(x => x.Schedule);
    }

    [Fact]
    public void Ucretli_grup_gecerli_tutar_ister()
    {
        var badFee = Json("{\"isPaid\":true,\"amount\":0,\"feeType\":\"monthly\"}");
        var result = _validator.TestValidate(ValidRequest(fee: badFee));
        result.ShouldHaveValidationErrorFor(x => x.Fee);
    }

    [Fact]
    public void Ucretli_grup_gecerli_ucret_tipi_ister()
    {
        var badFee = Json("{\"isPaid\":true,\"amount\":100,\"feeType\":\"gecersiz\"}");
        var result = _validator.TestValidate(ValidRequest(fee: badFee));
        result.ShouldHaveValidationErrorFor(x => x.Fee);
    }

    [Fact]
    public void Ucretli_grup_dogru_ayarlarla_kabul_edilir()
    {
        var goodFee = Json("{\"isPaid\":true,\"amount\":150.50,\"feeType\":\"monthly\"}");
        var result = _validator.TestValidate(ValidRequest(fee: goodFee));
        result.ShouldNotHaveValidationErrorFor(x => x.Fee);
    }

    [Fact]
    public void Ucretsiz_grup_tutar_istemez()
    {
        var freeFee = Json("{\"isPaid\":false}");
        var result = _validator.TestValidate(ValidRequest(fee: freeFee));
        result.ShouldNotHaveValidationErrorFor(x => x.Fee);
    }

    [Fact]
    public void Bos_isim_reddedilir()
    {
        var req = ValidRequest() with { Name = "" };
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Theory]
    [InlineData(2010, 2011)]
    [InlineData(10, 121)]
    public void Yas_120_ustu_dogum_yili_reddedilir(int ageMin, int ageMax)
    {
        var result = _validator.TestValidate(ValidRequest(ageMin: ageMin, ageMax: ageMax));
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Aktif_grupta_sifir_kontenjan_reddedilir()
    {
        var result = _validator.TestValidate(ValidRequest() with { Capacity = 0 });
        result.ShouldHaveValidationErrorFor(x => x.Capacity);
    }

    [Fact]
    public void Pasif_grupta_sifir_kontenjan_kabul_edilir()
    {
        var result = _validator.TestValidate(ValidRequest() with { Capacity = 0, ReserveCapacity = 0, IsActive = false });
        result.ShouldNotHaveValidationErrorFor(x => x.Capacity);
    }
}
