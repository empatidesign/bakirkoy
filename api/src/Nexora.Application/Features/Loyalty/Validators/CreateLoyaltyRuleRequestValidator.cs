using FluentValidation;
using Nexora.Application.Features.Loyalty.Requests;

namespace Nexora.Application.Features.Loyalty.Validators;

public class CreateLoyaltyRuleRequestValidator : AbstractValidator<CreateLoyaltyRuleRequest>
{
    public CreateLoyaltyRuleRequestValidator()
    {
        RuleFor(x => x.ActionKey)
            .NotEmpty().WithMessage("Eylem anahtarı zorunludur.")
            .MaximumLength(100).WithMessage("Eylem anahtarı 100 karakteri aşamaz.");

        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Etiket zorunludur.")
            .MaximumLength(200).WithMessage("Etiket 200 karakteri aşamaz.");

        RuleFor(x => x.Points)
            .GreaterThanOrEqualTo(0).WithMessage("Puan negatif olamaz.");
    }
}
