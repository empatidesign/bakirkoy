using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.TopMenu.Requests;

namespace Nexora.Application.Features.TopMenu.Validators;

// 2026-07-30 denetiminde tespit edildi (P1): TopMenu Create/Update endpoint'lerinde
// hiçbir FluentValidation validator'ı yoktu (Departments/Roles/CitizenMenu'nün aksine).
// Canlı testte tamamen boş title/icon/color kabul ediliyordu (200), 5000 karakter
// title VARCHAR(120) DB sütun sınırını aşıp yakalanmamış 500 hatası veriyordu,
// iconType/linkType için enum aralık dışı (999) değerler sorunsuzca kabul ediliyordu.
public class CreateTopMenuItemRequestValidator : AbstractValidator<CreateTopMenuItemRequest>
{
    public CreateTopMenuItemRequestValidator()
    {
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

        RuleFor(x => x.IconType).IsInEnum().WithMessage("Geçersiz ikon türü.");
        RuleFor(x => x.LinkType).IsInEnum().WithMessage("Geçersiz link türü.");
    }
}

public class UpdateTopMenuItemRequestValidator : AbstractValidator<UpdateTopMenuItemRequest>
{
    public UpdateTopMenuItemRequestValidator()
    {
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

        RuleFor(x => x.IconType).IsInEnum().WithMessage("Geçersiz ikon türü.");
        RuleFor(x => x.LinkType).IsInEnum().WithMessage("Geçersiz link türü.");
    }
}
