using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.CompanyAuth.Dtos;

namespace Nexora.Application.Features.CompanyAuth.Validators;

public class CompanyRegisterRequestValidator : AbstractValidator<CompanyRegisterRequest>
{
    public CompanyRegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Firma adı zorunludur.")
            .MaximumLength(200).WithMessage("Firma adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Firma adı");

        RuleFor(x => x.TaxNumber)
            .NotEmpty().WithMessage("Vergi numarası zorunludur.")
            .Must(v => v.Length is 10 or 11 && v.All(char.IsDigit))
            .WithMessage("Vergi numarası 10 haneli (VKN) veya 11 haneli (TCKN) olmalıdır.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .Matches(@"^0[0-9]{10}$").WithMessage("Telefon numarası 0 ile başlamalı ve 11 haneli olmalıdır.");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Adres zorunludur.")
            .MaximumLength(500).WithMessage("Adres 500 karakteri aşamaz.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifre zorunludur.")
            .MinimumLength(8).WithMessage("Şifre en az 8 karakter olmalıdır.")
            .Matches(@"\p{Lu}").WithMessage("Şifre en az bir büyük harf içermelidir.") // Türkçe büyük harfler (Ş,Ğ,Ü,Ö,Ç,İ) dahil; bkz. PasswordPolicy.cs 2026-09-23 notu
            .Matches("[0-9]").WithMessage("Şifre en az bir rakam içermelidir.");

        RuleFor(x => x.ServiceCategoryId)
            .NotNull().WithMessage("Hizmet kategorisi zorunludur.");

        RuleFor(x => x.KvkkAccepted)
            .Equal(true).WithMessage("KVKK Aydınlatma Metni'ni okuduğunuzu ve bilgi edindiğinizi onaylamanız gerekiyor.");

        // Bildirim izni AÇIK RIZA gerektirir (KVKK Kurulu 18.02.2026 tarihli
        // 2026/347 ilke kararı): açık rıza asla bir hizmetin sunulmasının ön
        // koşulu yapılamaz, aksi halde rıza özgür irade ile verilmiş sayılmaz.
        // Bu yüzden burada .Equal(true) İLE ZORUNLU KILINMAZ; kullanıcı
        // isteğe bağlı olarak true/false gönderebilir, ikisi de geçerlidir.
    }
}
