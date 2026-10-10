using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenLoginRequestValidator : AbstractValidator<CitizenLoginRequest>
{
    public CitizenLoginRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("Telefon numarası veya T.C. kimlik numarası zorunludur.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifre alanı zorunludur.");
    }
}
