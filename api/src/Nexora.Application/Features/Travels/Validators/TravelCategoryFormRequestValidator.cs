using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels.Validators;

public class TravelCategoryFormRequestValidator : AbstractValidator<TravelCategoryFormRequest>
{
    public TravelCategoryFormRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kategori adı zorunludur.")
            .MaximumLength(150).WithMessage("Kategori adı 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kategori adı");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Kategori rengi zorunludur.")
            .MaximumLength(20).WithMessage("Geçersiz renk değeri.");
    }
}
