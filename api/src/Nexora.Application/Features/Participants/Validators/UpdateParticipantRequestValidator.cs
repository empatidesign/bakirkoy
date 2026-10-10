using FluentValidation;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants.Validators;

public class UpdateParticipantRequestValidator : AbstractValidator<UpdateParticipantRequest>
{
    public UpdateParticipantRequestValidator()
    {
        When(x => !string.IsNullOrWhiteSpace(x.Phone), () =>
            RuleFor(x => x.Phone!)
                .Must(BeValidPhone).WithMessage("Geçerli bir telefon numarası giriniz."));

        When(x => !string.IsNullOrWhiteSpace(x.GuardianPhone), () =>
            RuleFor(x => x.GuardianPhone!)
                .Must(BeValidPhone).WithMessage("Geçerli bir veli telefon numarası giriniz."));

        When(x => !string.IsNullOrWhiteSpace(x.Email), () =>
            RuleFor(x => x.Email!)
                .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz."));

        When(x => !string.IsNullOrWhiteSpace(x.GuardianEmail), () =>
            RuleFor(x => x.GuardianEmail!)
                .EmailAddress().WithMessage("Geçerli bir veli e-posta adresi giriniz."));
    }

    private static bool BeValidPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length is >= 10 and <= 11;
    }
}
