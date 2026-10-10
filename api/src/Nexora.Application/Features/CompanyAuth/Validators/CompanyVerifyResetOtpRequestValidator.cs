using FluentValidation;
using Nexora.Application.Features.CompanyAuth.Dtos;

namespace Nexora.Application.Features.CompanyAuth.Validators;

public class CompanyVerifyResetOtpRequestValidator : AbstractValidator<CompanyVerifyResetOtpRequest>
{
    public CompanyVerifyResetOtpRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("E-posta adresi zorunludur.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("Doğrulama kodu zorunludur.")
            .Length(6).WithMessage("Doğrulama kodu 6 haneli olmalıdır.")
            .Matches(@"^\d{6}$").WithMessage("Doğrulama kodu yalnızca rakamlardan oluşmalıdır.");
    }
}
