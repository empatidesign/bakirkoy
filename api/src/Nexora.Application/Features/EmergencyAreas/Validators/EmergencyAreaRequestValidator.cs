using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.EmergencyAreas.Dtos;

namespace Nexora.Application.Features.EmergencyAreas.Validators;

public class EmergencyAreaRequestValidator : AbstractValidator<EmergencyAreaRequest>
{
    public EmergencyAreaRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Alan adı zorunludur.")
            .MaximumLength(200).WithMessage("Alan adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Alan adı");

        RuleFor(x => x.Neighborhood)
            .NotEmpty().WithMessage("Mahalle zorunludur.")
            .MaximumLength(150).WithMessage("Mahalle 150 karakteri aşamaz.");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Açık adres zorunludur.")
            .MaximumLength(500).WithMessage("Açık adres 500 karakteri aşamaz.");

        RuleFor(x => x.Capacity)
            .GreaterThanOrEqualTo(0).WithMessage("Kapasite negatif olamaz.");

        RuleFor(x => x.AreaSizeM2)
            .GreaterThanOrEqualTo(0).WithMessage("Alan büyüklüğü negatif olamaz.");

        // 2026-07-30 denetiminde eklendi: koordinat aralığı hiç doğrulanmıyordu,
        // lat=999/lng=999 gibi geçersiz değerler sorunsuz kaydedilip harita
        // bileşenlerini (marker render, mesafe hesaplama) kırabiliyordu.
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90).WithMessage("Enlem (Latitude) -90 ile 90 arasında olmalıdır.")
            .When(x => x.Latitude.HasValue);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180).WithMessage("Boylam (Longitude) -180 ile 180 arasında olmalıdır.")
            .When(x => x.Longitude.HasValue);

        RuleFor(x => x.Manager)
            .NotEmpty().WithMessage("Sorumlu kişi adı zorunludur.")
            .When(IsNewPersonGrant);

        RuleFor(x => x.ManagerEmail)
            .NotEmpty().WithMessage("Sorumlu kişi e-postası zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(IsNewPersonGrant);
    }

    private static bool IsNewPersonGrant(EmergencyAreaRequest r) => r.GrantAccess && r.ManagerId is null;
}
