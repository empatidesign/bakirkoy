using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityInstructorRequestValidator : AbstractValidator<CreateFacilityInstructorRequest>
{
    public CreateFacilityInstructorRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Eğitmen adı zorunludur.")
            .MaximumLength(200).WithMessage("Eğitmen adı 200 karakteri aşamaz.");

        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. Kimlik No zorunludur.")
            .Length(11).WithMessage("T.C. Kimlik No 11 haneli olmalıdır.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .Must(p => p is not null && p.Length == 11).WithMessage("Geçerli bir telefon numarası giriniz.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-posta zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.");

        RuleFor(x => x.DeliveryChannel)
            .NotEmpty().WithMessage("Şifre teslim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms").WithMessage("Teslim kanalı E-posta veya SMS olmalıdır.");
    }
}

public class UpdateFacilityInstructorRequestValidator : AbstractValidator<UpdateFacilityInstructorRequest>
{
    public UpdateFacilityInstructorRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Eğitmen adı zorunludur.")
            .MaximumLength(200).WithMessage("Eğitmen adı 200 karakteri aşamaz.");

        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. Kimlik No zorunludur.")
            .Length(11).WithMessage("T.C. Kimlik No 11 haneli olmalıdır.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .Must(p => p is not null && p.Length == 11).WithMessage("Geçerli bir telefon numarası giriniz.");
    }
}
