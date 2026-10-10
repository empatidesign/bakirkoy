using System.Text.Json;
using FluentValidation.TestHelper;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Facilities.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

// Kullanıcı isteği (2026-09-06): "hiçbir modülde yönetici ekleme zorunluluğu
// olmayacak" — FacilityModule şablonunu (Spor Salonu, Havuz, Kaşif Çocuk vb. 8
// modülün paylaştığı ortak kod yolu) kullanan CreateFacilityRequestValidator'da
// ManagerId.NotNull().When(!GrantAccess) kuralı vardı; ServiceFacilityRequestValidator
// (Hizmet Tesisleri) ve EmergencyAreaRequestValidator (Acil Toplanma) ile
// tutarsızdı. Kural kaldırıldı — bu testler regresyonu önler.
public class FacilityRequestValidatorTests
{
    private readonly CreateFacilityRequestValidator createValidator = new();
    private readonly UpdateFacilityRequestValidator updateValidator = new();

    [Theory]
    [InlineData("", null)]
    [InlineData("\"capacity\":null,", null)]
    [InlineData("\"capacity\":0,", 0)]
    [InlineData("\"capacity\":120,", 120)]
    [InlineData("\"capacity\":\"120\",", 120)]
    public void Capacity_can_be_omitted_or_null_in_create_and_update_json(string capacityJson, int? expected)
    {
        var json = $$"""
            {
                {{capacityJson}}
                "name": "Test Salonu",
                "kind": "indoor",
                "serviceFacilityId": "cd218b72-e390-468f-8c30-d707610c2231",
                "isActive": true
            }
            """;
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var create = JsonSerializer.Deserialize<CreateFacilityRequest>(json, options)!;
        var update = JsonSerializer.Deserialize<UpdateFacilityRequest>(json, options)!;

        Assert.Equal(expected, create.Capacity);
        Assert.Equal(expected, update.Capacity);
        createValidator.TestValidate(create).ShouldNotHaveAnyValidationErrors();
        updateValidator.TestValidate(update).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Negative_capacity_is_still_rejected_for_create_and_update()
    {
        createValidator.TestValidate(ValidCreateRequest() with { Capacity = -1 })
            .ShouldHaveValidationErrorFor(x => x.Capacity);
        updateValidator.TestValidate(ValidUpdateRequest() with { Capacity = -1 })
            .ShouldHaveValidationErrorFor(x => x.Capacity);
    }

    private static CreateFacilityRequest ValidCreateRequest(
        Guid? managerId = null,
        string? manager = null,
        string? managerEmail = null,
        bool grantAccess = false) => new(
        Name: "Test Salonu",
        Kind: "indoor",
        ServiceFacilityId: Guid.NewGuid(),
        Capacity: 50,
        ManagerId: managerId,
        ManagerName: null,
        ManagerRoleKey: null,
        ManagerRoleName: null,
        ManagerPhone: null,
        ManagerEmail: managerEmail,
        EmergencyPhone: null,
        IsActive: true)
    {
        Manager = manager,
        GrantAccess = grantAccess,
    };

    private static UpdateFacilityRequest ValidUpdateRequest(
        Guid? managerId = null,
        string? manager = null,
        string? managerEmail = null,
        bool grantAccess = false) => new(
        Name: "Test Salonu",
        Kind: "indoor",
        ServiceFacilityId: Guid.NewGuid(),
        Capacity: 50,
        ManagerId: managerId,
        ManagerName: null,
        ManagerRoleKey: null,
        ManagerRoleName: null,
        ManagerPhone: null,
        ManagerEmail: managerEmail,
        EmergencyPhone: null,
        IsActive: true)
    {
        Manager = manager,
        GrantAccess = grantAccess,
    };

    [Fact]
    public void Create_Yonetici_hic_secilmemis_ve_erisim_verilmemis_ise_gecerlidir()
    {
        var req = ValidCreateRequest(managerId: null, manager: null, grantAccess: false);
        var result = createValidator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Create_Mevcut_yoneticiden_secilmis_ise_gecerlidir()
    {
        var req = ValidCreateRequest(managerId: Guid.NewGuid());
        var result = createValidator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Create_Erisim_veriliyor_ad_ve_eposta_doluysa_gecerlidir()
    {
        var req = ValidCreateRequest(manager: "Yeni Kişi", managerEmail: "yeni@test.com", grantAccess: true);
        var result = createValidator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Create_Erisim_veriliyor_ama_eposta_bos_ise_hata_verir()
    {
        var req = ValidCreateRequest(manager: "Yeni Kişi", managerEmail: null, grantAccess: true);
        var result = createValidator.TestValidate(req);
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Update_Yonetici_hic_secilmemis_ve_erisim_verilmemis_ise_gecerlidir()
    {
        var req = ValidUpdateRequest(managerId: null, manager: null, grantAccess: false);
        var result = updateValidator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Update_Mevcut_yoneticiden_secilmis_ise_gecerlidir()
    {
        var req = ValidUpdateRequest(managerId: Guid.NewGuid());
        var result = updateValidator.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
