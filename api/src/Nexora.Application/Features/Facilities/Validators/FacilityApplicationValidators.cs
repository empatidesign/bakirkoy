using FluentValidation;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityApplicationRequestValidator : AbstractValidator<CreateFacilityApplicationRequest>
{
    public CreateFacilityApplicationRequestValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty().WithMessage("Tesis seçimi zorunludur.");
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Program seçimi zorunludur.");
        RuleFor(x => x.GroupId).NotEmpty().WithMessage("Grup seçimi zorunludur.");
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad soyad zorunludur.")
            .MaximumLength(200).WithMessage("Ad soyad 200 karakteri aşamaz.");
        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. Kimlik No zorunludur.")
            .Length(11).WithMessage("T.C. Kimlik No 11 hane olmalıdır.");
        RuleFor(x => x.Phone).NotEmpty().WithMessage("Telefon zorunludur.");

        When(x => x.BirthDate.HasValue && (DateTime.UtcNow - x.BirthDate.Value).TotalDays / 365.25 < 18, () =>
        {
            RuleFor(x => x.GuardianPhone)
                .NotEmpty().WithMessage("18 yaşından küçük katılımcılar için veli telefonu zorunludur.");
        });
    }
}
