using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class TravelRestrictionRulesTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("{}", false)]
    [InlineData("gecersiz-json", false)]
    [InlineData("{\"sultangaziResidentOnly\": true}", true)]
    [InlineData("{\"sultangaziResidentOnly\": false}", false)]
    [InlineData("{\"sultangaziResidentOnly\": true, \"allowOutsideSultangazi\": true}", false)]
    [InlineData("{\"sultangaziResidentOnly\": \"true\"}", true)]
    public void RequiresSultangaziResidency_dogru_calisir(string? json, bool expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.RequiresSultangaziResidency(json));
    }

    [Theory]
    [InlineData("{\"residencyMode\": \"sultangazi_only\"}", ResidencyMode.SultangaziOnly)]
    [InlineData("{\"residencyMode\": \"outside_only\"}", ResidencyMode.OutsideOnly)]
    [InlineData("{\"residencyMode\": \"anyone\"}", ResidencyMode.Anyone)]
    [InlineData("{}", ResidencyMode.Anyone)]
    [InlineData(null, ResidencyMode.Anyone)]
    [InlineData("{\"sultangaziResidentOnly\": true}", ResidencyMode.SultangaziOnly)]
    [InlineData("{\"residencyMode\": \"bilinmeyen\"}", ResidencyMode.Anyone)]
    public void ReadResidencyMode_dogru_moda_cevirir(string? json, ResidencyMode expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.ReadResidencyMode(json));
    }

    [Theory]
    [InlineData("{\"documentRequired\": true}", true)]
    [InlineData("{\"documentRequired\": false}", false)]
    [InlineData("{}", false)]
    [InlineData(null, false)]
    public void DocumentRequired_dogru_calisir(string? json, bool expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.DocumentRequired(json));
    }

    [Theory]
    [InlineData("{\"requiresGuardianConsent\": true}", true)]
    [InlineData("{}", false)]
    public void RequiresGuardianConsent_dogru_calisir(string? json, bool expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.RequiresGuardianConsent(json));
    }

    // V09: PeriodWindow sınırları Türkiye TAKVİMİNDE kurulup UTC'ye çevrilir (gezi tarihi UTC saklanır,
    // TurkeyDateTimeConverter girdiyi TR→UTC çevirir). Bu yüzden beklenen sınırlar TR gün başlangıcının
    // UTC karşılığıdır (TR 00:00 = bir önceki gün 21:00Z) — eski naive-UTC beklentisi V09'da hatalıydı.
    [Fact]
    public void PeriodWindow_daily_bir_gunluk_pencere_verir()
    {
        var date = new DateTime(2026, 3, 15, 10, 30, 0, DateTimeKind.Utc);
        var (start, end) = TravelRestrictionRules.PeriodWindow("daily", date);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 3, 15)), start);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 3, 16)), end);
    }

    [Fact]
    public void PeriodWindow_weekly_pazartesi_baslar_yedi_gun_surer()
    {
        var date = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var (start, end) = TravelRestrictionRules.PeriodWindow("weekly", date);
        Assert.Equal(DayOfWeek.Monday, TurkeyTime.ToTurkey(start).DayOfWeek);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 3, 9)), start);
        Assert.Equal(7, (end - start).TotalDays);
    }

    [Fact]
    public void PeriodWindow_monthly_ayin_ilk_gunu_baslar()
    {
        var date = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var (start, end) = TravelRestrictionRules.PeriodWindow("monthly", date);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 3, 1)), start);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 4, 1)), end);
    }

    [Fact]
    public void PeriodWindow_yearly_yilin_ilk_gunu_baslar()
    {
        var date = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var (start, end) = TravelRestrictionRules.PeriodWindow("yearly", date);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 1, 1)), start);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2027, 1, 1)), end);
    }

    [Fact]
    public void PeriodWindow_bilinmeyen_period_min_max_verir()
    {
        var date = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var (start, end) = TravelRestrictionRules.PeriodWindow("bilinmeyen", date);
        Assert.Equal(DateTime.MinValue, start);
        Assert.Equal(DateTime.MaxValue, end);
    }

    [Theory]
    [InlineData(null, 4)]
    [InlineData("", 4)]
    [InlineData("{}", 4)]
    [InlineData("gecersiz-json", 4)]
    [InlineData("{\"maxCompanions\": 2}", 2)]
    [InlineData("{\"maxCompanions\": 0}", 0)]
    [InlineData("{\"maxCompanions\": -1}", 4)]
    public void MaxGuests_dogru_calisir(string? json, int expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.MaxGuests(json));
    }

    // Kullanıcı bulgusu (2026-08-09): "Gezi eklerken yetişkin kişi aynı rezervasyonda çocuklarını
    // ekleyememektedir. Lakin tek tek rezervasyon ile istediği kadar kişiyi ekleyebilmektedir."
    // Kök neden: MaxGroupSize eskiden yalnızca maxCompanions+1'den hesaplanıyordu, allowChildren/
    // maxChildren'ı hiç dikkate almıyordu. maxCompanions=0 (form varsayılanı) + allowChildren=true
    // + maxChildren=2 olan bir gezide veli "kendim + 1 çocuk" seçtiğinde toplam 2 kişi, eski mantıkla
    // sınır 0+1=1 olduğu için reddediliyordu.
    [Theory]
    [InlineData("{\"maxCompanions\": 0, \"allowChildren\": true, \"maxChildren\": 2}", 3)] // 1 (kendisi) + 0 refakatçi + 2 çocuk
    [InlineData("{\"maxCompanions\": 0, \"allowChildren\": false}", 1)] // çocuk kapalı, refakatçi 0 -> yalnızca kendisi
    [InlineData("{\"maxCompanions\": 2, \"allowChildren\": true, \"maxChildren\": 1}", 4)] // 1 + 2 + 1
    // 2026-08-14 kendi-denetimimde bulundu: bu iki satır bayattı. 3af4392 commit'i
    // (gerçek kullanıcı düzeltmesi) MaxChildren'ın maxChildren alanı hiç belirtilmemişken
    // varsayılanını 1'den UnlimitedChildrenPerReservation=99'a çıkarmıştı ("sınırsız
    // çocuk" davranışı) ama bu testler güncellenmemişti. Doğru beklenen: 1 (kendisi) +
    // 4 (varsayılan maxCompanions) + 99 (varsayılan maxChildren, sınırsız) = 104.
    [InlineData("{}", 104)] // varsayılan: maxCompanions=4, allowChildren=true, maxChildren=99 (sınırsız) -> 1+4+99
    [InlineData(null, 104)]
    public void MaxGroupSize_kendisi_refakatci_ve_izinliyse_cocuk_sayisini_toplar(string? json, int expected)
    {
        Assert.Equal(expected, TravelRestrictionRules.MaxGroupSize(json));
    }

    [Fact]
    public void MaxGroupSize_veli_kendisi_artı_bir_cocuk_secebilir_maxCompanions_sifir_olsa_bile()
    {
        // Regresyon: bu senaryo eskiden (maxCompanions+1=1) 2 kişilik seçimi reddederdi.
        const string json = "{\"maxCompanions\": 0, \"allowChildren\": true, \"maxChildren\": 1}";
        var maxGroupSize = TravelRestrictionRules.MaxGroupSize(json);
        const int requestedCount = 2; // kendisi + 1 çocuk, aynı rezervasyon
        Assert.True(requestedCount <= maxGroupSize, $"Beklenen: {requestedCount} <= {maxGroupSize}");
    }
}
