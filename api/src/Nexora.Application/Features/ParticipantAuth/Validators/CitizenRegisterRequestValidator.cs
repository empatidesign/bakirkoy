using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenRegisterRequestValidator : AbstractValidator<CitizenRegisterRequest>
{
    public CitizenRegisterRequestValidator()
    {
        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.BirthDate)
            .NotEmpty().WithMessage("Doğum tarihi zorunludur.")
            .LessThanOrEqualTo(DateTime.UtcNow.Date).WithMessage("Doğum tarihi gelecekte olamaz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifre zorunludur.")
            .MinimumLength(8).WithMessage("Şifre en az 8 karakter olmalıdır.")
            .Matches(@"[A-ZĞÜŞİÖÇ]").WithMessage("Şifre en az bir büyük harf içermelidir.")
            .Matches(@"[0-9]").WithMessage("Şifre en az bir rakam içermelidir.");
    }
}
