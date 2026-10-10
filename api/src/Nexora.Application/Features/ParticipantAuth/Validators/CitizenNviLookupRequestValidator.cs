using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.ParticipantAuth.Dtos;

namespace Nexora.Application.Features.ParticipantAuth.Validators;

public class CitizenNviLookupRequestValidator : AbstractValidator<CitizenNviLookupRequest>
{
    public CitizenNviLookupRequestValidator()
    {
        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Must(TcKimlikValidator.IsValid).WithMessage("Geçerli bir T.C. kimlik numarası giriniz.");

        RuleFor(x => x.BirthDate)
            .NotEmpty().WithMessage("Doğum tarihi zorunludur.")
            .LessThanOrEqualTo(DateTime.UtcNow.Date).WithMessage("Doğum tarihi gelecekte olamaz.");
    }
}
