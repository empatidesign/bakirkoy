using FluentValidation;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants.Validators;

public class SendPasswordResetRequestValidator : AbstractValidator<SendPasswordResetRequest>
{
    public SendPasswordResetRequestValidator()
    {
        RuleFor(x => x.Channel)
            .NotEmpty().WithMessage("Gönderim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms").WithMessage("Gönderim kanalı E-posta veya SMS olmalıdır.");
    }
}
