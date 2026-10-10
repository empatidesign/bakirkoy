using Nexora.Application.Features.Facilities;
using Xunit;

namespace Nexora.UnitTests.Application;

public class FacilityParticipationLimitTests
{
    [Fact]
    public void Window_yearly_takvim_yili_sinirlari()
    {
        var w = FacilityParticipationLimit.Window("yearly", new DateTime(2026, 6, 15));
        Assert.NotNull(w);
        Assert.Equal(new DateTime(2026, 1, 1), w!.Value.Start);
        Assert.Equal(new DateTime(2027, 1, 1), w.Value.End);
    }

    [Fact]
    public void Window_monthly_varsayilan_ayin_biri()
    {
        var w = FacilityParticipationLimit.Window("monthly", new DateTime(2026, 6, 15));
        Assert.Equal(new DateTime(2026, 6, 1), w!.Value.Start);
        Assert.Equal(new DateTime(2026, 7, 1), w.Value.End);
    }

    [Fact]
    public void Window_monthly_reset_gunu_15_ekrandaki_ayar_uygulanir()
    {
        var before = FacilityParticipationLimit.Window("monthly", new DateTime(2026, 6, 14), 15);
        Assert.Equal(new DateTime(2026, 5, 15), before!.Value.Start);
        Assert.Equal(new DateTime(2026, 6, 15), before.Value.End);

        var onReset = FacilityParticipationLimit.Window("monthly", new DateTime(2026, 6, 15), 15);
        Assert.Equal(new DateTime(2026, 6, 15), onReset!.Value.Start);
        Assert.Equal(new DateTime(2026, 7, 15), onReset.Value.End);
    }

    [Fact]
    public void Window_weekly_pazartesi_baslar()
    {
        var w = FacilityParticipationLimit.Window("weekly", new DateTime(2026, 6, 17));
        Assert.Equal(DayOfWeek.Monday, w!.Value.Start.DayOfWeek);
        Assert.Equal(new DateTime(2026, 6, 15), w.Value.Start);
        Assert.Equal(new DateTime(2026, 6, 22), w.Value.End);
    }

    [Fact]
    public void MonthlyResetDay_ayardan_okunur_yoksa_bir()
    {
        Assert.Equal(15, FacilityParticipationLimit.MonthlyResetDay("{\"attendanceLimitResetDay\":15}"));
        Assert.Equal(1, FacilityParticipationLimit.MonthlyResetDay("{}"));
        Assert.Equal(1, FacilityParticipationLimit.MonthlyResetDay(null));
        Assert.Equal(28, FacilityParticipationLimit.MonthlyResetDay("{\"attendanceLimitResetDay\":40}"));
    }

    [Fact]
    public void Resolve_override_kapali_generalden_okur()
    {
        var (type, count) = FacilityParticipationLimit.Resolve(false, "monthly", 3, "{\"attendanceLimitEnabled\":true,\"attendanceLimitType\":\"yearly\",\"attendanceLimitCount\":5}");
        Assert.Equal("yearly", type);
        Assert.Equal(5, count);
    }

    [Fact]
    public void Resolve_override_acik_grup_degerini_kullanir()
    {
        var (type, count) = FacilityParticipationLimit.Resolve(true, "monthly", 2, "{\"attendanceLimitType\":\"yearly\",\"attendanceLimitCount\":5}");
        Assert.Equal("monthly", type);
        Assert.Equal(2, count);
    }

    private const string SettingsWithClass =
        "{\"attendanceLimitEnabled\":true,\"attendanceLimitType\":\"yearly\",\"attendanceLimitCount\":5," +
        "\"participationClasses\":[{\"minAge\":8,\"maxAge\":12,\"attendanceLimitOverride\":true,\"attendanceLimitType\":\"yearly\",\"attendanceLimitCount\":1,\"isActive\":true}]}";

    [Fact]
    public void ResolveEffective_yas_sinifi_override_grup_ve_geneli_ezer_K02()
    {
        var (type, count) = FacilityParticipationLimit.ResolveEffective(SettingsWithClass, groupOverride: true, "yearly", 2, age: 10);
        Assert.Equal("yearly", type);
        Assert.Equal(1, count);
    }

    [Fact]
    public void ResolveEffective_yas_sinifina_uymayan_grup_override_kullanir()
    {
        var (_, count) = FacilityParticipationLimit.ResolveEffective(SettingsWithClass, groupOverride: true, "yearly", 2, age: 30);
        Assert.Equal(2, count);
    }

    [Fact]
    public void ResolveEffective_yas_yoksa_ve_grup_override_kapaliysa_genel()
    {
        var (_, count) = FacilityParticipationLimit.ResolveEffective(SettingsWithClass, groupOverride: false, "yearly", 2, age: null);
        Assert.Equal(5, count);
    }

    [Fact]
    public void ResolveEffective_vatandas_ve_yonetim_ayni_sonucu_verir()
    {
        var citizen = FacilityParticipationLimit.ResolveEffective(SettingsWithClass, true, "yearly", 2, 10);
        var admin = FacilityParticipationLimit.ResolveEffective(SettingsWithClass, true, "yearly", 2, 10);
        Assert.Equal(citizen, admin);
    }
}
