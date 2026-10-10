using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants.Validators;

public class CreateParticipantRequestValidator : AbstractValidator<CreateParticipantRequest>
{
    public CreateParticipantRequestValidator()
    {
        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.BirthDate)
            .NotEmpty().WithMessage("Doğum tarihi zorunludur.")
            .LessThan(DateTime.UtcNow.AddDays(1)).WithMessage("Doğum tarihi gelecekte olamaz.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Telefon numarası zorunludur.")
            .When(x => !IsMinor(x.BirthDate));

        RuleFor(x => x.DeliveryChannel)
            .NotEmpty().WithMessage("Şifre teslim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms").WithMessage("Teslim kanalı Email veya Sms olmalıdır.");
    }

    private static bool IsMinor(DateTime birthDate)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 18;
    }
}
