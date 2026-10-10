using FluentValidation;
using Nexora.Application.Common.Security;
using Nexora.Application.Features.Auth.Dtos;

namespace Nexora.Application.Features.Auth.Validators;

// Kullanıcı isteği (2026-09-07): şifre sıfırlama sadece e-posta ile değil, telefon
// numarasıyla da yapılabilmeli. Bu yüzden EmailAddress() kuralı kaldırıldı; girilen
// değer LoginIdentifier üzerinden e-posta ya da telefon olarak doğrulanıyor.
public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Value)
            .NotEmpty().WithMessage("E-posta veya telefon numarası zorunludur.")
            .Must(LoginIdentifier.IsValid)
            .WithMessage("Geçerli bir e-posta adresi veya telefon numarası girin.");
    }
}
