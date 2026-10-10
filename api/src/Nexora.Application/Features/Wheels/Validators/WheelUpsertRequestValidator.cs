using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels.Validators;

public class WheelUpsertRequestValidator : AbstractValidator<WheelUpsertRequest>
{
    public WheelUpsertRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Çark başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Çark başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Çark başlığı");

        RuleFor(x => x.DailySpinLimit)
            .GreaterThanOrEqualTo(0).WithMessage("Günlük çevirme hakkı negatif olamaz.");

        RuleFor(x => x.Slices)
            .Must(s => s != null && s.Count >= 2).WithMessage("En az iki çark dilimi gereklidir.");

        RuleForEach(x => x.Slices).ChildRules(slice =>
        {
            slice.RuleFor(y => y.Label)
                .NotEmpty().WithMessage("Dilim etiketi zorunludur.");
            slice.RuleFor(y => y.WinRate)
                .InclusiveBetween(0, 100).WithMessage("Kazanma oranı 0 ile 100 arasında olmalıdır.");
            slice.RuleFor(y => y.GiftId)
                .NotNull().When(y => y.Type == "gift")
                .WithMessage("Hediye dilimi için hediye seçilmelidir.");
        });

        RuleFor(x => x.Slices)
            .Must(s => s != null && s.Sum(y => y.WinRate) == 100)
            .WithMessage("Kazanma oranlarının toplamı %100 olmalıdır.")
            .When(x => x.Slices != null && x.Slices.Count >= 2);

        // Kullanıcı isteği (2026-09-20): puan algoritması açıksa alanları anlamlı olmalı.
        RuleFor(x => x.PointsAlgorithmBase)
            .GreaterThanOrEqualTo(0).WithMessage("Başlangıç puanı negatif olamaz.")
            .When(x => x.PointsAlgorithmEnabled);
        RuleFor(x => x.PointsAlgorithmMax)
            .GreaterThanOrEqualTo(0).WithMessage("Azami puan negatif olamaz.")
            .When(x => x.PointsAlgorithmEnabled);
        RuleFor(x => x.PointsAlgorithmMax)
            .GreaterThanOrEqualTo(x => x.PointsAlgorithmBase)
            .WithMessage("Azami puan, başlangıç puanından küçük olamaz.")
            .When(x => x.PointsAlgorithmEnabled && x.PointsAlgorithmMax > 0);
        RuleFor(x => x.PointsAlgorithmMaxSpins)
            .GreaterThanOrEqualTo(0).WithMessage("Azami çevirme sayısı negatif olamaz.")
            .When(x => x.PointsAlgorithmEnabled);
    }
}
