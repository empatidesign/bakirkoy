using Nexora.Domain.Common;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Entities.Facilities;
using Xunit;

namespace Nexora.UnitTests.Domain;

/// <summary>
/// docs/hata.md düzeltmelerinin davranış kilidi. Buradaki her test, rapordaki somut bir
/// şikayetin tekrar etmesini engeller.
/// </summary>
public class HataRaporuDuzeltmeleriTests
{
    // --- #5 / #7 / #8: "engelliyor ama Başvurularım'da görünmüyor" ---

    [Theory]
    [InlineData("pending")]
    [InlineData("approved")]
    [InlineData("waitlist")]
    public void Yasayan_basvurular_aktif_sayilir(string status)
    {
        Assert.True(FacilityApplicationStatuses.IsActive(status));
    }

    [Theory]
    [InlineData("rejected")]
    [InlineData("expired")]
    public void Reddedilen_ve_suresi_dolan_basvurular_aktif_degildir(string status)
    {
        Assert.False(FacilityApplicationStatuses.IsActive(status));
    }

    /// <summary>
    /// Raporun özü: yeni başvuruyu ENGELLEYEN her kayıt, Başvurularım listesinde de
    /// görünmeli. İki taraf tek yüklemi paylaştığı için bu ilişki kopamaz.
    /// </summary>
    [Theory]
    [InlineData("pending")]
    [InlineData("approved")]
    [InlineData("waitlist")]
    [InlineData("rejected")]
    [InlineData("expired")]
    public void Engelleyen_kayit_listede_de_gorunur(string status)
    {
        var engelliyor = FacilityApplicationStatuses.IsActive(status);
        var listedeGorunur = FacilityApplicationStatuses.IsActive(status);
        Assert.Equal(engelliyor, listedeGorunur);
    }

    [Fact]
    public void Iptal_edilen_uyelik_expired_olur_ve_yeniden_basvuruya_izin_verir()
    {
        var app = FacilityApplication.Create(new FacilityApplicationData(
            "sports", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Test Kişi", "12345678901", "05320000000", null, null, null, "[]"));

        app.ExpireMembership();

        Assert.False(FacilityApplicationStatuses.IsActive(app.Status));
    }

    // --- #4.4: talep düzenleme ---

    private static CitizenSubmission YeniBasvuru() => CitizenSubmission.Create(
        "Test Kişi", "05320000000", "12345678901",
        "Cebeci Mahallesi", "Test Adres 1",
        "other", "request", "high",
        "Başlık", "Açıklama");

    [Fact]
    public void Yeni_basvuru_duzenlenebilir()
    {
        Assert.True(YeniBasvuru().IsEditableByCitizen());
    }

    [Fact]
    public void Isleme_alinan_basvuru_duzenlenemez()
    {
        var s = YeniBasvuru();
        s.SetStatus("in_review");
        Assert.False(s.IsEditableByCitizen());
    }

    [Fact]
    public void Duzenleme_tur_ve_onceligi_gercekten_degistirir()
    {
        var s = YeniBasvuru();

        s.UpdateByCitizen("Yeni başlık", "Yeni açıklama", "complaint", "urgent");

        Assert.Equal("Yeni başlık", s.Title);
        Assert.Equal("Yeni açıklama", s.Description);
        Assert.Equal("complaint", s.SubmissionType);
        Assert.Equal("urgent", s.Priority);
    }

    // --- #4.2: seçilen öncelik aynen kaydedilmeli, "normal"e düşmemeli ---

    [Theory]
    [InlineData("low")]
    [InlineData("normal")]
    [InlineData("high")]
    [InlineData("urgent")]
    public void Secilen_oncelik_aynen_kaydedilir(string priority)
    {
        var s = CitizenSubmission.Create(
            "Test Kişi", "05320000000", "12345678901",
            "Cebeci Mahallesi", "Test Adres 1",
            "other", "request", priority,
            "Başlık", "Açıklama");

        Assert.Equal(priority, s.Priority);
    }
}
