using FluentValidation;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;

namespace Nexora.Application.Features.Seda.Validators;

public class SedaApplicationFormRequestValidator : AbstractValidator<SedaApplicationFormRequest>
{
    private static readonly string[] Statuses = ["pending", "approved", "rejected"];

    public SedaApplicationFormRequestValidator()
    {
        RuleFor(x => x.StudentName)
            .NotEmpty().WithMessage("Öğrenci adı zorunludur.")
            .MaximumLength(100).WithMessage("Öğrenci adı 100 karakteri aşamaz.");

        RuleFor(x => x.StudentSurname)
            .NotEmpty().WithMessage("Öğrenci soyadı zorunludur.")
            .MaximumLength(100).WithMessage("Öğrenci soyadı 100 karakteri aşamaz.");

        RuleFor(x => x.Tckn)
            .NotEmpty().WithMessage("T.C. Kimlik No zorunludur.")
            .Length(11).WithMessage("T.C. Kimlik No 11 haneli olmalıdır.")
            .Matches("^[0-9]+$").WithMessage("T.C. Kimlik No yalnızca rakamlardan oluşmalıdır.");

        RuleFor(x => x.SchoolName)
            .NotEmpty().WithMessage("Okul seçimi zorunludur.")
            .MaximumLength(200).WithMessage("Okul adı 200 karakteri aşamaz.");

        RuleFor(x => x.NextYearGrade)
            .NotEmpty().WithMessage("Gelecek yıl sınıfı zorunludur.");

        RuleFor(x => x.EducationType)
            .NotEmpty().WithMessage("Eğitim türü seçimi zorunludur.");

        RuleFor(x => x.ParentPhone)
            .NotEmpty().WithMessage("Veli telefonu zorunludur.");

        RuleFor(x => x.Status)
            .Must(s => Statuses.Contains(s)).WithMessage("Geçersiz başvuru durumu.");

        RuleFor(x => x.BirthDate)
            .Must(BeAValidPastDate).WithMessage("Geçerli bir doğum tarihi giriniz.")
            .When(x => !string.IsNullOrWhiteSpace(x.BirthDate));
    }

    private static bool BeAValidPastDate(string? value)
        => DateTime.TryParse(value, out var d) && d.Date <= TurkeyTime.TodayDate();
}
