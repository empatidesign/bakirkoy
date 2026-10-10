using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries.Validators;

public class LibraryRequestValidator : AbstractValidator<LibraryRequest>
{
    public LibraryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kıraathane adı zorunludur.")
            .MaximumLength(200).WithMessage("Kıraathane adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kıraathane adı");

        RuleFor(x => x.ServiceFacilityId)
            .NotEmpty().WithMessage("Hizmet tesisi seçilmelidir.")
            .Must(v => Guid.TryParse(v, out _)).WithMessage("Hizmet tesisi seçilmelidir.");

        RuleFor(x => x.SeatingMode)
            .Must(v => v is null or "sirali" or "masali").WithMessage("Oturma türü geçersiz.");

        RuleFor(x => x.EntryControlMode)
            .Must(BeControlMode).WithMessage("Giriş kontrol modu geçersiz.");

        RuleFor(x => x.ExitControlMode)
            .Must(BeControlMode).WithMessage("Çıkış kontrol modu geçersiz.");

        RuleFor(x => x.Manager)
            .NotEmpty().WithMessage("Sorumlu kişi adı zorunludur.")
            .When(IsNewPersonGrant);

        RuleFor(x => x.ManagerEmail)
            .NotEmpty().WithMessage("Sorumlu kişi e-postası zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(IsNewPersonGrant);
    }

    private static bool IsNewPersonGrant(LibraryRequest r) => r.GrantAccess && !(Guid.TryParse(r.ManagerId, out var g) && g != Guid.Empty);

    private static bool BeControlMode(string? v) => v is null or "kiosk" or "qr" or "manual" or "none";
}
