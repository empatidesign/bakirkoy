using FluentValidation;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies.Validators;

public class CompanySetManualPasswordRequestValidator : AbstractValidator<CompanySetManualPasswordRequest>
{
    public CompanySetManualPasswordRequestValidator()
    {
        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Yeni şifre zorunludur.")
            .MinimumLength(8).WithMessage("Şifre en az 8 karakter olmalıdır.")
            .Matches(@"\p{Lu}").WithMessage("Şifre en az bir büyük harf içermelidir.") // Türkçe büyük harfler (Ş,Ğ,Ü,Ö,Ç,İ) dahil; bkz. PasswordPolicy.cs 2026-09-23 notu
            .Matches(@"[0-9]").WithMessage("Şifre en az bir rakam içermelidir.");
    }
}
