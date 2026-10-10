using FluentValidation;
using Nexora.Application.Common;
using Nexora.Domain.Common;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies.Validators;

public class CreateCampaignRequestValidator : AbstractValidator<CreateCampaignRequest>
{
    private static readonly string[] AllowedDiscountTypes = ["percentage", "fixed"];

    public CreateCampaignRequestValidator()
    {
        RuleFor(x => x.CompanyId)
            .NotEmpty().WithMessage("Firma seçimi zorunludur.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kampanya adı zorunludur.")
            .MaximumLength(200).WithMessage("Kampanya adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kampanya adı");

        RuleFor(x => x.DiscountType)
            .Must(type => AllowedDiscountTypes.Contains(type))
            .WithMessage("İndirim türü 'yüzde' veya 'tutar' olmalıdır.");

        RuleFor(x => x.DiscountValue)
            .GreaterThan(0).WithMessage("İndirim değeri sıfırdan büyük olmalıdır.");

        RuleFor(x => x.DiscountValue)
            .LessThanOrEqualTo(100).WithMessage("Yüzde indirim 100'ü aşamaz.")
            .When(x => x.DiscountType == "percentage");

        RuleFor(x => x.PerUserLimit)
            .GreaterThanOrEqualTo(1).WithMessage("Kişi başı kullanım limiti en az 1 olmalıdır.");

        RuleFor(x => x.TotalUsageLimit)
            .GreaterThanOrEqualTo(1).WithMessage("Toplam kullanım limiti en az 1 olmalıdır.")
            .When(x => x.TotalUsageLimit.HasValue);

        RuleFor(x => x.MinOrderAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Minimum tutar negatif olamaz.")
            .When(x => x.MinOrderAmount.HasValue);

        RuleFor(x => x.StartDate)
            .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("Bitiş tarihi başlangıçtan önce olamaz.");

        RuleForEach(x => x.Products).SetValidator(new CampaignProductInputValidator());
    }
}
