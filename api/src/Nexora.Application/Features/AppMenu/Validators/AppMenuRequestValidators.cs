using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.AppMenu.Requests;

namespace Nexora.Application.Features.AppMenu.Validators;

// 2026-08-13/14 denetiminde tespit edildi (P1 - aynı hata sınıfı, 2026-07-30 TopMenu
// denetimindeki gibi): AppMenu (Menü Yönetimi — "Sistem Modülleri" + "Menü Bölümleri")
// endpoint'lerinde hiç FluentValidation validator'ı yoktu. Canlı testte kanıtlandı:
// tamamen boş title/icon ile bölüm oluşturulabiliyordu (201), 5000 karakterlik title
// VARCHAR(120) DB sütun sınırını aşıp yakalanmamış 500 INTERNAL_SERVER_ERROR veriyordu.
// SectionId/ModuleKey Guid.Parse ile parse ediliyor — geçersiz GUID string'i de
// yakalanmamış FormatException ile 500 verir. Departments/Roles/CitizenMenu/TopMenu'deki
// desenle aynı hizaya getirildi.
public class UpsertSystemModuleRequestValidator : AbstractValidator<UpsertSystemModuleRequest>
{
    public UpsertSystemModuleRequestValidator()
    {
        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Etiket zorunludur.")
            .MaximumLength(120).WithMessage("Etiket 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Etiket");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.")
            .MaximumLength(1000).WithMessage("İkon değeri 1000 karakteri aşamaz.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .MaximumLength(20).WithMessage("Renk değeri 20 karakteri aşamaz.");

        RuleFor(x => x.CitizenRoute)
            .NotEmpty().WithMessage("Vatandaş rotası zorunludur.")
            .MaximumLength(200).WithMessage("Vatandaş rotası 200 karakteri aşamaz.");

        RuleFor(x => x.AdminRoute)
            .NotEmpty().WithMessage("Admin rotası zorunludur.")
            .MaximumLength(200).WithMessage("Admin rotası 200 karakteri aşamaz.");
    }
}

public class CreateMenuSectionRequestValidator : AbstractValidator<CreateMenuSectionRequest>
{
    public CreateMenuSectionRequestValidator()
    {
        // 2026-08-14 kendi-denetimimde bulundu: buraya eklediğim ^[a-z0-9-]+$ formatı
        // kısıtı, canlı DB'de mevcut olan gerçek E2E kayıtlarını (örn. "e2e_..._..."
        // alt çizgili anahtar) YENİ oluşturma için reddediyordu ve Key alanı sistemde
        // hiçbir yerde URL/route segmenti olarak kullanılmıyor (yalnızca admin panelde
        // salt-okunur monospace metin olarak gösteriliyor) — bu kısıt orijinal
        // TopMenu deseninde de yoktu, kapsam dışı bir sıkılaştırmaydı. Kaldırıldı.
        RuleFor(x => x.Key)
            .NotEmpty().WithMessage("Anahtar zorunludur.")
            .MaximumLength(60).WithMessage("Anahtar 60 karakteri aşamaz.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.")
            .MaximumLength(80).WithMessage("İkon değeri 80 karakteri aşamaz.");
    }
}

public class UpdateMenuSectionRequestValidator : AbstractValidator<UpdateMenuSectionRequest>
{
    public UpdateMenuSectionRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.")
            .MaximumLength(80).WithMessage("İkon değeri 80 karakteri aşamaz.");
    }
}

public class CreateMenuItemRequestValidator : AbstractValidator<CreateMenuItemRequest>
{
    public CreateMenuItemRequestValidator()
    {
        RuleFor(x => x.SectionId)
            .NotEmpty().WithMessage("Bölüm seçimi zorunludur.")
            .Must(v => Guid.TryParse(v, out _)).WithMessage("Geçersiz bölüm kimliği.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.")
            .MaximumLength(1000).WithMessage("İkon değeri 1000 karakteri aşamaz.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .MaximumLength(20).WithMessage("Renk değeri 20 karakteri aşamaz.");

        RuleFor(x => x.LinkTarget)
            .NotEmpty().WithMessage("Hedef link zorunludur.")
            .MaximumLength(1000).WithMessage("Hedef link 1000 karakteri aşamaz.");

        RuleFor(x => x.MobileLinkTarget)
            .MaximumLength(1000).WithMessage("Mobil hedef link 1000 karakteri aşamaz.")
            .When(x => x.MobileLinkTarget is not null);

        RuleFor(x => x.ModuleKey)
            .MaximumLength(60).WithMessage("Modül anahtarı 60 karakteri aşamaz.")
            .When(x => x.ModuleKey is not null);

        RuleFor(x => x.BadgeText)
            .MaximumLength(20).WithMessage("Rozet metni 20 karakteri aşamaz.")
            .When(x => x.BadgeText is not null);

        RuleFor(x => x.BadgeTone)
            .MaximumLength(20).WithMessage("Rozet rengi 20 karakteri aşamaz.")
            .When(x => x.BadgeTone is not null);

        RuleFor(x => x.IconType).IsInEnum().WithMessage("Geçersiz ikon türü.");
        RuleFor(x => x.LinkType).IsInEnum().WithMessage("Geçersiz link türü.");
    }
}

public class UpdateMenuItemRequestValidator : AbstractValidator<UpdateMenuItemRequest>
{
    public UpdateMenuItemRequestValidator()
    {
        RuleFor(x => x.SectionId)
            .NotEmpty().WithMessage("Bölüm seçimi zorunludur.")
            .Must(v => Guid.TryParse(v, out _)).WithMessage("Geçersiz bölüm kimliği.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.")
            .MaximumLength(1000).WithMessage("İkon değeri 1000 karakteri aşamaz.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .MaximumLength(20).WithMessage("Renk değeri 20 karakteri aşamaz.");

        RuleFor(x => x.LinkTarget)
            .NotEmpty().WithMessage("Hedef link zorunludur.")
            .MaximumLength(1000).WithMessage("Hedef link 1000 karakteri aşamaz.");

        RuleFor(x => x.MobileLinkTarget)
            .MaximumLength(1000).WithMessage("Mobil hedef link 1000 karakteri aşamaz.")
            .When(x => x.MobileLinkTarget is not null);

        RuleFor(x => x.ModuleKey)
            .MaximumLength(60).WithMessage("Modül anahtarı 60 karakteri aşamaz.")
            .When(x => x.ModuleKey is not null);

        RuleFor(x => x.BadgeText)
            .MaximumLength(20).WithMessage("Rozet metni 20 karakteri aşamaz.")
            .When(x => x.BadgeText is not null);

        RuleFor(x => x.BadgeTone)
            .MaximumLength(20).WithMessage("Rozet rengi 20 karakteri aşamaz.")
            .When(x => x.BadgeTone is not null);

        RuleFor(x => x.IconType).IsInEnum().WithMessage("Geçersiz ikon türü.");
        RuleFor(x => x.LinkType).IsInEnum().WithMessage("Geçersiz link türü.");
    }
}
