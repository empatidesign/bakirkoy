using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class ResidencyPolicyTests
{
    private static Participant MakeParticipant(string? ilceKodu = null, string? district = null, string? address = null)
    {
        var p = Participant.Create(
            tckn: "00000000001",
            fullName: "Test Kisi",
            birthDate: new DateTime(1990, 1, 1),
            gender: Gender.Male,
            isMinor: false,
            passwordHash: "x",
            email: null,
            phone: null,
            guardianPhone: null,
            guardianEmail: null,
            address: address);
        p.ApplyStructuredAddress(address, city: null, district: district, neighborhood: null, ilceKodu: ilceKodu);
        return p;
    }

    [Fact]
    public void IlceKodu_Sultangazi_ise_resident_true()
    {
        var p = MakeParticipant(ilceKodu: ResidencyPolicy.DefaultSultangaziDistrictCode);
        Assert.True(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void IlceKodu_baska_ilce_ise_resident_false()
    {
        var p = MakeParticipant(ilceKodu: "1234");
        Assert.False(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void IlceKodu_yoksa_district_adindan_sultangazi_yakalanir()
    {
        var p = MakeParticipant(district: "Sultangazi");
        Assert.True(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void IlceKodu_ve_district_yoksa_adres_metninden_yakalanir()
    {
        var p = MakeParticipant(address: "Cebeci Mah. SULTANGAZI / Istanbul");
        Assert.True(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void Hicbir_konum_bilgisi_yoksa_resident_false()
    {
        var p = MakeParticipant();
        Assert.False(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void IlceKodu_district_koduna_gore_onceliklidir()
    {
        var p = MakeParticipant(ilceKodu: "9999", district: "Sultangazi");
        Assert.False(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("00")]
    [InlineData("-1")]
    [InlineData(" ")]
    public void Anlamsiz_ilce_kodu_district_adina_dusurulur(string ilceKodu)
    {
        var p = MakeParticipant(ilceKodu: ilceKodu, district: "Sultangazi");
        Assert.True(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void Anlamsiz_ilce_kodu_ve_ilce_disi_district_resident_vermez()
    {
        var p = MakeParticipant(ilceKodu: "0", district: "Kadıköy");
        Assert.False(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Fact]
    public void Anlamsiz_ilce_kodu_adres_metnine_kadar_dusurulur()
    {
        var p = MakeParticipant(ilceKodu: "0", address: "Cebeci Mah. SULTANGAZI / Istanbul");
        Assert.True(ResidencyPolicy.IsSultangaziResident(p));
    }

    [Theory]
    [InlineData("2055", true)]
    [InlineData("9999", false)]
    [InlineData("1234", false)]
    public void Gecerli_ilce_kodu_hala_district_adini_ezer(string ilceKodu, bool expected)
    {
        var p = MakeParticipant(ilceKodu: ilceKodu, district: "Sultangazi");
        Assert.Equal(expected, ResidencyPolicy.IsSultangaziResident(p));
    }

    [Theory]
    [InlineData(ResidencyMode.Anyone, true, true)]
    [InlineData(ResidencyMode.Anyone, false, true)]
    [InlineData(ResidencyMode.SultangaziOnly, true, true)]
    [InlineData(ResidencyMode.SultangaziOnly, false, false)]
    [InlineData(ResidencyMode.OutsideOnly, true, false)]
    [InlineData(ResidencyMode.OutsideOnly, false, true)]
    public void IsAllowed_moda_gore_dogru_karar_verir(ResidencyMode mode, bool resident, bool expected)
    {
        var p = resident
            ? MakeParticipant(ilceKodu: ResidencyPolicy.DefaultSultangaziDistrictCode)
            : MakeParticipant(ilceKodu: "1234");
        Assert.Equal(expected, ResidencyPolicy.IsAllowed(mode, p));
    }

    [Fact]
    public void Ozel_district_kodu_parametresi_kullanilir()
    {
        var p = MakeParticipant(ilceKodu: "5000");
        Assert.True(ResidencyPolicy.IsSultangaziResident(p, sultangaziDistrictCode: "5000"));
        Assert.False(ResidencyPolicy.IsSultangaziResident(p, sultangaziDistrictCode: "6000"));
    }
}
