using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Education.Requests;

namespace Nexora.Application.Features.Education.Validators;

// 2026-08-13/14 denetiminde tespit edildi (aynı hata sınıfı, 2026-07-30 TopMenu/AppMenu
// denetimindeki gibi): Eğitim Kurumları (admin) VE eğitim geçmişi (hem admin HEM
// VATANDAŞ kendi kaydı için — citizen self-service uçları da bu DTO'ları kullanıyor)
// endpoint'lerinde hiç FluentValidation validator'ı yoktu. Name alanı VARCHAR(200) DB
// sütun sınırını aşan girdi yakalanmamış 500 verir. StartYear/EndYear üzerinde HİÇBİR
// mantık kontrolü yoktu — bir vatandaş kendi eğitim geçmişine StartYear=-5000 veya
// EndYear=99999 ya da EndYear < StartYear gibi anlamsız değerler girebiliyordu.
public class CreateEducationInstitutionRequestValidator : AbstractValidator<CreateEducationInstitutionRequest>
{
    public CreateEducationInstitutionRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kurum adı zorunludur.")
            .MaximumLength(200).WithMessage("Kurum adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kurum adı");

        RuleFor(x => x.Faculty)
            .MaximumLength(200).WithMessage("Fakülte adı 200 karakteri aşamaz.")
            .When(x => x.Faculty is not null);

        RuleFor(x => x.Department)
            .MaximumLength(200).WithMessage("Bölüm adı 200 karakteri aşamaz.")
            .When(x => x.Department is not null);

        RuleFor(x => x.Type).IsInEnum().WithMessage("Geçersiz kurum türü.");
        RuleFor(x => x.DegreeLevel).IsInEnum().WithMessage("Geçersiz derece seviyesi.")
            .When(x => x.DegreeLevel.HasValue);
    }
}

public class UpdateEducationInstitutionRequestValidator : AbstractValidator<UpdateEducationInstitutionRequest>
{
    public UpdateEducationInstitutionRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kurum adı zorunludur.")
            .MaximumLength(200).WithMessage("Kurum adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kurum adı");

        RuleFor(x => x.Faculty)
            .MaximumLength(200).WithMessage("Fakülte adı 200 karakteri aşamaz.")
            .When(x => x.Faculty is not null);

        RuleFor(x => x.Department)
            .MaximumLength(200).WithMessage("Bölüm adı 200 karakteri aşamaz.")
            .When(x => x.Department is not null);

        RuleFor(x => x.Type).IsInEnum().WithMessage("Geçersiz kurum türü.");
        RuleFor(x => x.DegreeLevel).IsInEnum().WithMessage("Geçersiz derece seviyesi.")
            .When(x => x.DegreeLevel.HasValue);
    }
}

public class CreateEducationHistoryRequestValidator : AbstractValidator<CreateEducationHistoryRequest>
{
    public CreateEducationHistoryRequestValidator()
    {
        RuleFor(x => x.Level).IsInEnum().WithMessage("Geçersiz eğitim seviyesi.");

        RuleFor(x => x.StartYear)
            .InclusiveBetween(1950, DateTime.UtcNow.Year + 1)
            .WithMessage($"Başlangıç yılı 1950 ile {DateTime.UtcNow.Year + 1} arasında olmalıdır.");

        RuleFor(x => x.EndYear)
            .InclusiveBetween(1950, DateTime.UtcNow.Year + 10)
            .WithMessage($"Bitiş yılı 1950 ile {DateTime.UtcNow.Year + 10} arasında olmalıdır.")
            .GreaterThanOrEqualTo(x => x.StartYear)
            .WithMessage("Bitiş yılı başlangıç yılından önce olamaz.")
            .When(x => x.EndYear.HasValue);
    }
}

public class UpdateEducationHistoryRequestValidator : AbstractValidator<UpdateEducationHistoryRequest>
{
    public UpdateEducationHistoryRequestValidator()
    {
        RuleFor(x => x.Level).IsInEnum().WithMessage("Geçersiz eğitim seviyesi.");

        RuleFor(x => x.StartYear)
            .InclusiveBetween(1950, DateTime.UtcNow.Year + 1)
            .WithMessage($"Başlangıç yılı 1950 ile {DateTime.UtcNow.Year + 1} arasında olmalıdır.");

        RuleFor(x => x.EndYear)
            .InclusiveBetween(1950, DateTime.UtcNow.Year + 10)
            .WithMessage($"Bitiş yılı 1950 ile {DateTime.UtcNow.Year + 10} arasında olmalıdır.")
            .GreaterThanOrEqualTo(x => x.StartYear)
            .WithMessage("Bitiş yılı başlangıç yılından önce olamaz.")
            .When(x => x.EndYear.HasValue);
    }
}
