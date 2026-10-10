using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenRefreshRequestValidator : AbstractValidator<CitizenRefreshRequest>
{
    public CitizenRefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("Oturum bilgisi zorunludur.");
    }
}
