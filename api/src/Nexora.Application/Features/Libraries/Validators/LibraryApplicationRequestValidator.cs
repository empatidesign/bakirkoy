using FluentValidation;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries.Validators;

public class LibraryApplicationRequestValidator : AbstractValidator<LibraryApplicationRequest>
{
    public LibraryApplicationRequestValidator()
    {
        RuleFor(x => x.ApplicantName)
            .NotEmpty().WithMessage("Ad zorunludur.")
            .MaximumLength(100).WithMessage("Ad 100 karakteri aşamaz.");
        RuleFor(x => x.ApplicantSurname)
            .NotEmpty().WithMessage("Soyad zorunludur.")
            .MaximumLength(100).WithMessage("Soyad 100 karakteri aşamaz.");
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon zorunludur.")
            .MinimumLength(10).WithMessage("Geçerli bir telefon numarası giriniz.")
            .MaximumLength(20).WithMessage("Telefon 20 karakteri aşamaz.");
        RuleFor(x => x.MembershipType)
            .NotEmpty().WithMessage("Üyelik türü zorunludur.")
            .MaximumLength(50).WithMessage("Üyelik türü 50 karakteri aşamaz.");
        When(x => !string.IsNullOrWhiteSpace(x.Email), () =>
            RuleFor(x => x.Email).EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz."));
        When(x => !string.IsNullOrWhiteSpace(x.Documents), () =>
            RuleFor(x => x.Documents!).MaximumLength(500).WithMessage("Belge bilgisi 500 karakteri aşamaz."));
    }
}
