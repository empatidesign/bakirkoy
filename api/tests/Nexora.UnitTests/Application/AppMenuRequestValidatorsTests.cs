using FluentValidation.TestHelper;
using Nexora.Application.Features.AppMenu.Requests;
using Nexora.Application.Features.AppMenu.Validators;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Application;

// 2026-08-13/14 denetiminde bulundu: AppMenu (Menü Yönetimi) endpoint'lerinde hiç
// FluentValidation validator'ı yoktu — boş title/icon kabul ediliyordu, VARCHAR(120)
// sınırını aşan title yakalanmamış 500 veriyordu, geçersiz GUID sectionId de 500
// veriyordu. Bu paket hem düzeltmenin doğru çalıştığını hem de (kendi-denetimde
// bulunan) Key alanına eklenip sonra kaldırılan aşırı-sıkı regex'in geri gelmediğini
// kalıcı olarak kanıtlar.
public class AppMenuRequestValidatorsTests
{
    private readonly CreateMenuSectionRequestValidator _createSection = new();
    private readonly UpdateMenuSectionRequestValidator _updateSection = new();
    private readonly CreateMenuItemRequestValidator _createItem = new();
    private readonly UpdateMenuItemRequestValidator _updateItem = new();
    private readonly UpsertSystemModuleRequestValidator _upsertModule = new();

    [Fact]
    public void CreateSection_bos_title_reddedilir()
    {
        var req = new CreateMenuSectionRequest("test-anahtar", "", "Star", true, true, true);
        var result = _createSection.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void CreateSection_120_karakteri_asan_title_reddedilir()
    {
        var req = new CreateMenuSectionRequest("test-anahtar", new string('A', 121), "Star", true, true, true);
        var result = _createSection.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void CreateSection_turkce_karakterli_key_kabul_edilir()
    {
        // 2026-08-14 kendi-denetimde bulunan regresyon: buraya eklenmiş olan
        // ^[a-z0-9-]+$ format kısıtı, gerçek DB'deki alt-çizgili E2E kayıtlarını ve
        // Türkçe karakterli anahtarları reddediyordu. Key sistemde URL/route segmenti
        // olarak kullanılmıyor — format kısıtı olmamalı.
        var req = new CreateMenuSectionRequest("ulaşım-bölümü_test", "Ulaşım", "Bus", true, true, true);
        var result = _createSection.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.Key);
    }

    [Fact]
    public void CreateSection_gecerli_veri_kabul_edilir()
    {
        var req = new CreateMenuSectionRequest("ulasim", "Ulaşım", "Bus", true, true, true);
        var result = _createSection.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateSection_bos_title_reddedilir()
    {
        var req = new UpdateMenuSectionRequest("", "Star", true, true, true);
        var result = _updateSection.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void CreateItem_gecersiz_sectionId_reddedilir()
    {
        var req = new CreateMenuItemRequest("gecersiz-guid", null, "Test", "Star", MenuIconType.Lucide,
            "#000", MenuLinkType.Module, "/test", null, true, true, false, true, true, null, null);
        var result = _createItem.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.SectionId);
    }

    [Fact]
    public void CreateItem_20_karakteri_asan_badgeText_reddedilir()
    {
        var req = new CreateMenuItemRequest(Guid.NewGuid().ToString(), null, "Test", "Star", MenuIconType.Lucide,
            "#000", MenuLinkType.Module, "/test", null, true, true, false, true, true, new string('X', 21), null);
        var result = _createItem.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.BadgeText);
    }

    [Fact]
    public void CreateItem_gecerli_veri_kabul_edilir()
    {
        var req = new CreateMenuItemRequest(Guid.NewGuid().ToString(), null, "Test", "Star", MenuIconType.Lucide,
            "#000", MenuLinkType.Module, "/test", null, true, true, false, true, true, null, null);
        var result = _createItem.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateItem_bos_title_reddedilir()
    {
        var req = new UpdateMenuItemRequest(Guid.NewGuid().ToString(), null, "", "Star", MenuIconType.Lucide,
            "#000", MenuLinkType.Module, "/test", null, true, true, false, true, true, null, null);
        var result = _updateItem.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void UpsertModule_bos_label_reddedilir()
    {
        var req = new UpsertSystemModuleRequest("", "CalendarDays", "#000", "/citizen", "/admin", true, 0, true);
        var result = _upsertModule.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Label);
    }

    [Fact]
    public void UpsertModule_gecerli_veri_kabul_edilir()
    {
        var req = new UpsertSystemModuleRequest("Etkinlikler", "CalendarDays", "#6366F1", "/etkinlikler", "/events", true, 0, true);
        var result = _upsertModule.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
