using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda.Validators;

public class SedaSchoolFormRequestValidator : AbstractValidator<SedaSchoolFormRequest>
{
    public SedaSchoolFormRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Okul adı zorunludur.")
            .MaximumLength(200).WithMessage("Okul adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Okul adı");
    }
}
