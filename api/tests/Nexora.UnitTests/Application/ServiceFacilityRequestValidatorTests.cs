using FluentValidation.TestHelper;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using Nexora.Application.Features.ServiceFacilities.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

// 2026-08-02 kullanıcı bildirimi: hizmet tesisi kaydında yönetici ataması artık
// zorunlu değil (mevcut yönetici kaldırılıp boş bırakılarak güncellenebilmeli).
// "Sisteme erişim ver" açıksa (yeni kişiye hesap açılıyorsa) ad ve e-posta hâlâ
// zorunlu — bir hesap açmak için bunlar teknik olarak gereklidir.
public class ServiceFacilityRequestValidatorTests
{
    private readonly ServiceFacilityRequestValidator validator = new();

    private static ServiceFacilityRequest ValidRequest(
        Guid? managerId = null,
        string? manager = null,
        string? managerEmail = null,
        bool grantAccess = false) => new(
        Name: "Test Tesis",
        Type: "sportsFacility",
        LocationType: "Indoor",
        OutdoorCategory: null,
        AreaSizeM2: null,
        Description: null,
        About: null,
        City: "İstanbul",
        District: "Sultangazi",
        Address: "Test Adres",
        Latitude: 41.1,
        Longitude: 28.8,
        ManagerId: managerId,
        EmergencyPhone: null,
        Website: null,
        Facebook: null,
        Instagram: null,
        Twitter: null,
        WeekdayOpen: "09:00",
        WeekdayClose: "18:00",
        WeekendOpen: "10:00",
        WeekendClose: "17:00",
        Facilities: null,
        AccessibilityFeatures: null,
        ParkingCapacity: 0,
        ParkingType: "Free",
        Capacity: null,
        OfferedServices: null,
        Images: null)
    {
        Manager = manager,
        ManagerEmail = managerEmail,
        GrantAccess = grantAccess,
    };

    [Fact]
    public void Yonetici_hic_secilmemis_ve_erisim_verilmemis_ise_gecerlidir()
    {
        // Kullanıcı isteği: yönetici atamadan (managerId=null, manager=null) tesis
        // kaydedilebilmeli — daha önce bu durumda hata veriyordu.
        var req = ValidRequest(managerId: null, manager: null, grantAccess: false);
        var result = validator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Mevcut_yoneticiden_secilmis_ise_gecerlidir()
    {
        var req = ValidRequest(managerId: Guid.NewGuid());
        var result = validator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Erisim_veriliyor_ad_ve_eposta_doluysa_gecerlidir()
    {
        var req = ValidRequest(manager: "Yeni Kişi", managerEmail: "yeni@test.com", grantAccess: true);
        var result = validator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Erisim_veriliyor_ama_eposta_bos_ise_hata_verir()
    {
        var req = ValidRequest(manager: "Yeni Kişi", managerEmail: null, grantAccess: true);
        var result = validator.TestValidate(req);
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Erisim_veriliyor_ama_ad_bos_ise_hata_verir()
    {
        var req = ValidRequest(manager: null, managerEmail: "yeni@test.com", grantAccess: true);
        var result = validator.TestValidate(req);
        Assert.False(result.IsValid);
    }

    // 2026-09-07 kullanıcı isteği: tesis bilgilerinde ad dışında hiçbir alan zorunlu
    // değil — tür, konum tipi, il, ilçe, adres ve otopark türü boş bırakılabilmeli.
    [Fact]
    public void Ad_ve_konum_disinda_alanlar_bos_ise_gecerlidir()
    {
        var req = ValidRequest() with
        {
            Type = null,
            LocationType = null,
            City = null,
            District = null,
            Address = null,
            ParkingType = null,
        };
        var result = validator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Tesis_adi_bos_ise_hata_verir()
    {
        var req = ValidRequest() with { Name = "" };
        var result = validator.TestValidate(req);
        Assert.False(result.IsValid);
    }
    [Fact]
    public void Konumu_olmayan_tesis_kaydedilemez()
    {
        var result = validator.TestValidate(ValidRequest() with { Latitude = null, Longitude = null });
        Assert.False(result.IsValid);
    }
}
