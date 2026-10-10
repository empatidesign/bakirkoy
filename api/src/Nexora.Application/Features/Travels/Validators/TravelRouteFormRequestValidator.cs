using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels.Validators;

public class TravelRouteFormRequestValidator : AbstractValidator<TravelRouteFormRequest>
{
    public TravelRouteFormRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Gezi adı zorunludur.")
            .MaximumLength(200).WithMessage("Gezi adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Gezi adı");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.");

        RuleFor(x => x.Destination)
            .NotEmpty().WithMessage("Gezi güzergahı/hedefi zorunludur.")
            .MaximumLength(200).WithMessage("Güzergah 200 karakteri aşamaz.");

        RuleFor(x => x.DeparturePoint)
            .MaximumLength(300).WithMessage("Kalkış noktası 300 karakteri aşamaz.");

        RuleFor(x => x.Gender)
            .Must(g => g is "male" or "female" or "mixed")
            .WithMessage("Geçersiz cinsiyet seçimi.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(x => x.MinAge)
            .WithMessage("Üst yaş sınırı, alt yaş sınırından küçük olamaz.")
            .When(x => x.MaxAge > 0);
    }
}
