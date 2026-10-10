using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenForgotPasswordRequestValidator : AbstractValidator<CitizenForgotPasswordRequest>
{
    public CitizenForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty().WithMessage("Telefon numarası veya T.C. kimlik numarası zorunludur.");

        RuleFor(x => x.BirthDate)
            .LessThanOrEqualTo(DateTime.UtcNow.Date).WithMessage("Doğum tarihi gelecekte olamaz.")
            .When(x => x.BirthDate.HasValue);
    }
}
