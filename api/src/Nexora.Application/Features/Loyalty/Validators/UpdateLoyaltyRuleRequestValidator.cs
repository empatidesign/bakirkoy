using FluentValidation;
using Nexora.Application.Features.Loyalty.Requests;

namespace Nexora.Application.Features.Loyalty.Validators;

public class UpdateLoyaltyRuleRequestValidator : AbstractValidator<UpdateLoyaltyRuleRequest>
{
    public UpdateLoyaltyRuleRequestValidator()
    {
        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Etiket zorunludur.")
            .MaximumLength(200).WithMessage("Etiket 200 karakteri aşamaz.");

        RuleFor(x => x.Points)
            .GreaterThanOrEqualTo(0).WithMessage("Puan negatif olamaz.");
    }
}
