using FluentValidation;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels.Validators;

public class TravelApplicationFormRequestValidator : AbstractValidator<TravelApplicationFormRequest>
{
    public TravelApplicationFormRequestValidator()
    {
        RuleFor(x => x.TravelId)
            .NotEmpty().WithMessage("Gezi seçimi zorunludur.");

        RuleFor(x => x.ParticipantId)
            .NotEmpty().WithMessage("Katılımcı seçimi zorunludur.");

        RuleFor(x => x.Status)
            .Must(s => s is "pending" or "reviewing" or "approved" or "rejected" or "waitlist")
            .WithMessage("Geçersiz başvuru durumu.");
    }
}
