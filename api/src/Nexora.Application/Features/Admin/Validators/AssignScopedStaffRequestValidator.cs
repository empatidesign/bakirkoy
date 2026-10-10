using FluentValidation;
using Nexora.Application.Features.Admin.Dtos;

namespace Nexora.Application.Features.Admin.Validators;

public class AssignScopedStaffRequestValidator : AbstractValidator<AssignScopedStaffRequest>
{
    public AssignScopedStaffRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Ad Soyad zorunludur.")
            .MaximumLength(100).WithMessage("Ad Soyad 100 karakteri aşamaz.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-posta zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .MaximumLength(200).WithMessage("E-posta 200 karakteri aşamaz.");

        RuleFor(x => x.RoleTemplateKey)
            .NotEmpty().WithMessage("Rol şablonu seçimi zorunludur.");

        RuleFor(x => x.ScopeModuleKey)
            .NotEmpty().WithMessage("Yetki alanı modülü zorunludur.");

        RuleFor(x => x.ScopeRefId)
            .NotEmpty().WithMessage("Yetki alanı seçimi zorunludur.");

        RuleFor(x => x.ScopeName)
            .NotEmpty().WithMessage("Yetki alanı adı zorunludur.");

        RuleFor(x => x.ScopeType)
            .NotEmpty().WithMessage("Yetki alanı türü zorunludur.");

        RuleFor(x => x.DeliveryChannel)
            .NotEmpty().WithMessage("Şifre teslim kanalı zorunludur.")
            .Must(c => c is "Email" or "Sms")
            .WithMessage("Teslim kanalı Email veya Sms olmalıdır.");
    }
}
