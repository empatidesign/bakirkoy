using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Loyalty.Requests;

namespace Nexora.Application.Features.Loyalty.Validators;

public class CreateRewardRequestValidator : AbstractValidator<CreateRewardRequest>
{
    public CreateRewardRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Ödül adı zorunludur.")
            .MaximumLength(200).WithMessage("Ödül adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Ödül adı");

        RuleFor(x => x.PointsRequired)
            .GreaterThanOrEqualTo(0).WithMessage("Gereken puan negatif olamaz.");

        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0).WithMessage("Stok negatif olamaz.");
    }
}
