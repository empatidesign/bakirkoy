using FluentValidation;
using Nexora.Application.Features.SmsPermissions.Dtos;

namespace Nexora.Application.Features.SmsPermissions.Validators;

public class BulkSmsSendAccessRequestValidator : AbstractValidator<BulkSmsSendAccessRequest>
{
    public BulkSmsSendAccessRequestValidator()
    {
        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("İşlem türü zorunludur.")
            .Must(a => a is "grant" or "revoke").WithMessage("İşlem 'grant' veya 'revoke' olmalıdır.");

        RuleFor(x => x)
            .Must(x => (x.UserIds?.Count ?? 0) > 0 || (x.RoleIds?.Count ?? 0) > 0)
            .WithMessage("En az bir kullanıcı veya rol seçmelisiniz.");
    }
}

public class BulkScopeAssignmentRequestValidator : AbstractValidator<BulkScopeAssignmentRequest>
{
    public BulkScopeAssignmentRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => (x.UserIds?.Count ?? 0) > 0 || (x.RoleIds?.Count ?? 0) > 0)
            .WithMessage("En az bir kullanıcı veya rol seçmelisiniz.");

        RuleFor(x => x.Targets)
            .NotEmpty().WithMessage("En az bir tesis/grup/seans seçmelisiniz.");

        RuleForEach(x => x.Targets).ChildRules(target =>
        {
            target.RuleFor(t => t.Kind)
                .Must(k => k is "facility" or "group" or "session")
                .WithMessage("Kapsam türü 'facility', 'group' veya 'session' olmalıdır.");
            target.RuleFor(t => t.RefId).NotEmpty().WithMessage("Kayıt seçimi zorunludur.");
            target.RuleFor(t => t.ModuleKey)
                .NotEmpty().WithMessage("Tesis/Grup için modül seçimi zorunludur.")
                .When(t => t.Kind is "facility" or "group");
        });
    }
}
