using FluentValidation;
using Nexora.Domain.Common;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries.Validators;

public class LibraryReservationRequestValidator : AbstractValidator<LibraryReservationRequest>
{
    public LibraryReservationRequestValidator()
    {
        RuleFor(x => x.SlotStart)
            .Must(d => d is null || (d.Value >= TurkeyTime.TodayStartUtc() && d.Value < TurkeyTime.TodayStartUtc().AddDays(1)))
            .WithMessage("Rezervasyon yalnızca bugün için yapılabilir.");

        RuleFor(x => x)
            .Must(r => !string.IsNullOrWhiteSpace(r.MemberName) || !string.IsNullOrWhiteSpace(r.Tckn) || !string.IsNullOrWhiteSpace(r.ParticipantId))
            .WithMessage("Üye bilgisi (TC veya ad) gereklidir.");
    }
}
