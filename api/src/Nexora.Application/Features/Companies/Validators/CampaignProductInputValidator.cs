using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies.Validators;

public class CampaignProductInputValidator : AbstractValidator<CampaignProductInput>
{
    public CampaignProductInputValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Ürün adı zorunludur.")
            .MaximumLength(200).WithMessage("Ürün adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Ürün adı");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).WithMessage("Ürün fiyatı negatif olamaz.")
            .When(x => x.Price.HasValue);
    }
}
