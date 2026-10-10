using FluentValidation;
using Nexora.Application.Features.Admin.Dtos;

namespace Nexora.Application.Features.Admin.Validators;

public class CreateAdminRequestValidator : AbstractValidator<CreateAdminRequest>
{
    public CreateAdminRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad Soyad zorunludur.")
            .MaximumLength(100).WithMessage("Ad Soyad 100 karakteri aşamaz.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-posta zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .MaximumLength(200).WithMessage("E-posta 200 karakteri aşamaz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .MinimumLength(10).WithMessage("Geçerli bir telefon numarası giriniz.")
            .MaximumLength(20).WithMessage("Telefon 20 karakteri aşamaz.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Rol seçimi zorunludur.");

        // Kullanıcı talimatı (2026-08-04): "şifreyi manuel oluşturulabilir" — ManualPassword
        // doluysa DeliveryChannel'a gerek yok (rastgele şifre üretilmiyor, gönderilmiyor).
        // Boşsa eski davranış (zorunlu Email/Sms teslim kanalı) aynen korunur.
        RuleFor(x => x.DeliveryChannel)
            .NotEmpty().WithMessage("Şifre teslim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms")
            .WithMessage("Teslim kanalı Email veya Sms olmalıdır.")
            .When(x => string.IsNullOrWhiteSpace(x.ManualPassword));

        RuleFor(x => x.ManualPassword)
            .Must(p => p!.Length >= 8 && p.Any(char.IsUpper) && p.Any(char.IsDigit))
            .WithMessage("Manuel şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.")
            .When(x => !string.IsNullOrWhiteSpace(x.ManualPassword));
    }
}
