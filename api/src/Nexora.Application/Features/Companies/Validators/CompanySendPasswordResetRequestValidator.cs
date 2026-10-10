using FluentValidation;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies.Validators;

public class CompanySendPasswordResetRequestValidator : AbstractValidator<CompanySendPasswordResetRequest>
{
    public CompanySendPasswordResetRequestValidator()
    {
        RuleFor(x => x.Channel)
            .NotEmpty().WithMessage("Gönderim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms").WithMessage("Gönderim kanalı E-posta veya SMS olmalıdır.");
    }
}
