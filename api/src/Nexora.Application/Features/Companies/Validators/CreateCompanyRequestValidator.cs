using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies.Validators;

public class CreateCompanyRequestValidator : AbstractValidator<CreateCompanyRequest>
{
    public CreateCompanyRequestValidator()
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

        RuleFor(x => x.ServiceCategoryId)
            .NotNull().WithMessage("Hizmet kategorisi zorunludur.");
    }
}
