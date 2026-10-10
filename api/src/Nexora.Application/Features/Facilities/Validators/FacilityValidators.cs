using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityRequestValidator : AbstractValidator<CreateFacilityRequest>
{
    public CreateFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tesis adı zorunludur.")
            .MaximumLength(200).WithMessage("Tesis adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Tesis adı");
        RuleFor(x => x.Kind)
            .Must(k => k == "indoor" || k == "outdoor").WithMessage("Mekan türü geçersiz.");
        RuleFor(x => x.ServiceFacilityId)
            .NotNull().WithMessage("Hizmet tesisi seçimi zorunludur.");
        // Kullanıcı isteği (2026-09-06): "hiçbir modülde yönetici ekleme zorunluluğu
        // olmayacak" — ManagerId.NotNull() kuralı kaldırıldı (Emergency Areas'taki
        // EmergencyAreaRequestValidator ile tutarlı: yönetici tamamen opsiyonel,
        // sadece "yeni kişi + erişim ver" seçilirse Manager/ManagerEmail zorunlu).
        RuleFor(x => x.Manager)
            .NotEmpty().WithMessage("Sorumlu kişi adı zorunludur.")
            .When(IsNewPersonGrant);
        RuleFor(x => x.ManagerEmail)
            .NotEmpty().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(IsNewPersonGrant);
        RuleFor(x => x.Capacity)
            .GreaterThanOrEqualTo(0).WithMessage("Kapasite negatif olamaz.");
    }

    private static bool IsNewPersonGrant(CreateFacilityRequest x)
        => x.GrantAccess && (x.ManagerId is null || x.ManagerId == Guid.Empty);
}

public class UpdateFacilityRequestValidator : AbstractValidator<UpdateFacilityRequest>
{
    public UpdateFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tesis adı zorunludur.")
            .MaximumLength(200).WithMessage("Tesis adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Tesis adı");
        RuleFor(x => x.Kind)
            .Must(k => k == "indoor" || k == "outdoor").WithMessage("Mekan türü geçersiz.");
        RuleFor(x => x.ServiceFacilityId)
            .NotNull().WithMessage("Hizmet tesisi seçimi zorunludur.");
        // Kullanıcı isteği (2026-09-06): bkz. CreateFacilityRequestValidator'daki not.
        RuleFor(x => x.Manager)
            .NotEmpty().WithMessage("Sorumlu kişi adı zorunludur.")
            .When(IsNewPersonGrant);
        RuleFor(x => x.ManagerEmail)
            .NotEmpty().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(IsNewPersonGrant);
        RuleFor(x => x.Capacity)
            .GreaterThanOrEqualTo(0).WithMessage("Kapasite negatif olamaz.");
    }

    private static bool IsNewPersonGrant(UpdateFacilityRequest x)
        => x.GrantAccess && (x.ManagerId is null || x.ManagerId == Guid.Empty);
}
