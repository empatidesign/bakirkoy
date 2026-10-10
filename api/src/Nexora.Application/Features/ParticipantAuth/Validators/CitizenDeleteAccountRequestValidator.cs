using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenDeleteAccountRequestValidator : AbstractValidator<CitizenDeleteAccountRequest>
{
    public CitizenDeleteAccountRequestValidator()
    {
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Hesabınızı silmek için şifrenizi giriniz.");
    }
}
