using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenVerifyOtpRequestValidator : AbstractValidator<CitizenVerifyOtpRequest>
{
    public CitizenVerifyOtpRequestValidator()
    {
        RuleFor(x => x.OtpSessionToken)
            .NotEmpty().WithMessage("OTP oturum tokeni zorunludur.");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("OTP kodu zorunludur.")
            .Length(6).WithMessage("OTP kodu 6 haneli olmalıdır.")
            .Matches(@"^\d{6}$").WithMessage("OTP kodu yalnızca rakamlardan oluşmalıdır.");
    }
}
