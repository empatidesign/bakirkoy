using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenVerifyResetOtpRequestValidator : AbstractValidator<CitizenVerifyResetOtpRequest>
{
    public CitizenVerifyResetOtpRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("Telefon numarası veya T.C. kimlik numarası zorunludur.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("Doğrulama kodu zorunludur.")
            .Length(6).WithMessage("Doğrulama kodu 6 haneli olmalıdır.")
            .Matches(@"^\d{6}$").WithMessage("Doğrulama kodu yalnızca rakamlardan oluşmalıdır.");
    }
}
