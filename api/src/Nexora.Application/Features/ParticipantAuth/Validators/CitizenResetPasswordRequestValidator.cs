using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenResetPasswordRequestValidator : AbstractValidator<CitizenResetPasswordRequest>
{
    public CitizenResetPasswordRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("Telefon numarası veya T.C. kimlik numarası zorunludur.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("OTP kodu zorunludur.")
            .Length(6).WithMessage("OTP kodu 6 haneli olmalıdır.")
            .Matches(@"^\d{6}$").WithMessage("OTP kodu yalnızca rakamlardan oluşmalıdır.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Yeni şifre zorunludur.")
            .MinimumLength(8).WithMessage("Şifre en az 8 karakter olmalıdır.")
            .Matches(@"\p{Lu}").WithMessage("Şifre en az bir büyük harf içermelidir.") // Türkçe büyük harfler (Ş,Ğ,Ü,Ö,Ç,İ) dahil; bkz. PasswordPolicy.cs 2026-09-23 notu
            .Matches(@"[0-9]").WithMessage("Şifre en az bir rakam içermelidir.");
    }
}
