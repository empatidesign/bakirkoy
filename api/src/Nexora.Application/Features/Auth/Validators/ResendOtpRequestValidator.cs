using FluentValidation;
using Nexora.Application.Features.Auth.Dtos;

namespace Nexora.Application.Features.Auth.Validators;

public class ResendOtpRequestValidator : AbstractValidator<ResendOtpRequest>
{
    public ResendOtpRequestValidator()
    {
        RuleFor(x => x.OtpSessionToken)
            .NotEmpty().WithMessage("OTP oturum tokeni zorunludur.");
    }
}
