using FluentValidation;
using Nexora.Application.Features.CompanyAuth.Dtos;

namespace Nexora.Application.Features.CompanyAuth.Validators;

public class CompanyChangePasswordRequestValidator : AbstractValidator<CompanyChangePasswordRequest>
{
    public CompanyChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Mevcut şifrenizi giriniz.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Yeni şifre zorunludur.")
            .MinimumLength(8).WithMessage("Şifre en az 8 karakter olmalıdır.")
            .Matches(@"\p{Lu}").WithMessage("Şifre en az bir büyük harf içermelidir.") // Türkçe büyük harfler (Ş,Ğ,Ü,Ö,Ç,İ) dahil; bkz. PasswordPolicy.cs 2026-09-23 notu
            .Matches("[0-9]").WithMessage("Şifre en az bir rakam içermelidir.")
            .NotEqual(x => x.CurrentPassword).WithMessage("Yeni şifre mevcut şifreden farklı olmalıdır.");
    }
}
