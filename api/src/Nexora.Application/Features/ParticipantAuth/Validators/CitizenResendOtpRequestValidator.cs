using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenResendOtpRequestValidator : AbstractValidator<CitizenResendOtpRequest>
{
    public CitizenResendOtpRequestValidator()
    {
        RuleFor(x => x.OtpSessionToken)
            .NotEmpty().WithMessage("OTP oturum tokeni zorunludur.");
    }
}
