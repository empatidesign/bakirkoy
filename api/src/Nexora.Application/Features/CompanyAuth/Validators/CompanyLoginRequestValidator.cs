using FluentValidation;
using Nexora.Application.Features.CompanyAuth.Dtos;

namespace Nexora.Application.Features.CompanyAuth.Validators;

public class CompanyLoginRequestValidator : AbstractValidator<CompanyLoginRequest>
{
    public CompanyLoginRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("Telefon numarası veya e-posta adresi zorunludur.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifre zorunludur.");
    }
}
