using FluentValidation;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda.Validators;

public class CitizenSedaApplyRequestValidator : AbstractValidator<CitizenSedaApplyRequest>
{
    public CitizenSedaApplyRequestValidator()
    {
        RuleFor(x => x.SchoolName)
            .NotEmpty().WithMessage("Okul seçimi zorunludur.")
            .MaximumLength(200).WithMessage("Okul adı 200 karakteri aşamaz.");

        RuleFor(x => x.NextYearGrade)
            .NotEmpty().WithMessage("Gelecek yıl sınıfı zorunludur.");

        RuleFor(x => x.EducationType)
            .NotEmpty().WithMessage("Eğitim türü seçimi zorunludur.");

        RuleFor(x => x.ExamCenterName)
            .NotEmpty().WithMessage("Sınav merkezi seçimi zorunludur.");
    }
}
