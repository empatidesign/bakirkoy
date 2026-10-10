using FluentValidation;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenFamilyConfirmRequestValidator : AbstractValidator<CitizenFamilyConfirmRequest>
{
    public CitizenFamilyConfirmRequestValidator()
    {
        RuleFor(x => x.SelectedTckns)
            .NotNull().WithMessage("En az bir kişi seçmelisiniz.")
            .NotEmpty().WithMessage("En az bir kişi seçmelisiniz.");
    }
}
