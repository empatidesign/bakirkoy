using FluentValidation;
using Nexora.Application.Common;
using Nexora.Domain.Common;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda.Validators;

public class CreateSedaPeriodRequestValidator : AbstractValidator<CreateSedaPeriodRequest>
{
    public CreateSedaPeriodRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Dönem adı zorunludur.")
            .MaximumLength(150).WithMessage("Dönem adı 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Dönem adı");

        RuleFor(x => x.StartDate)
            .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.MaxApplications)
            .GreaterThan(0).WithMessage("Maksimum başvuru sayısı 0'dan büyük olmalıdır.");
    }
}

public class UpdateSedaPeriodRequestValidator : AbstractValidator<UpdateSedaPeriodRequest>
{
    public UpdateSedaPeriodRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Dönem adı zorunludur.")
            .MaximumLength(150).WithMessage("Dönem adı 150 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Dönem adı");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.MaxApplications)
            .GreaterThan(0).WithMessage("Maksimum başvuru sayısı 0'dan büyük olmalıdır.");
    }
}
