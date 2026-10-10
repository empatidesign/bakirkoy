using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda.Validators;

public class CreateSedaDefinitionRequestValidator : AbstractValidator<CreateSedaDefinitionRequest>
{
    private static readonly string[] Types = ["subject", "education-type", "grade", "exam-center", "neighborhood"];

    public CreateSedaDefinitionRequestValidator()
    {
        RuleFor(x => x.Type)
            .Must(t => Types.Contains(t)).WithMessage("Geçersiz tanım türü.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Ad zorunludur.")
            .MaximumLength(150).WithMessage("Ad 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Ad");
    }
}

public class UpdateSedaDefinitionRequestValidator : AbstractValidator<UpdateSedaDefinitionRequest>
{
    public UpdateSedaDefinitionRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Ad zorunludur.")
            .MaximumLength(150).WithMessage("Ad 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Ad");
    }
}
