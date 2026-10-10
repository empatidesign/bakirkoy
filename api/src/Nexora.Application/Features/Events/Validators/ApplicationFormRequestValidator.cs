using FluentValidation;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events.Validators;

public class ApplicationFormRequestValidator : AbstractValidator<ApplicationFormRequest>
{
    private static readonly string[] Statuses = ["pending", "approved", "rejected", "reviewing", "waitlist"];
    private static readonly string[] DocumentStatuses = ["none", "missing", "reviewing", "complete"];
    private static readonly string[] PaymentStatuses = ["unpaid", "paid", "partial", "refund", "exempt"];

    public ApplicationFormRequestValidator()
    {
        RuleFor(x => x.ParticipantId).NotEmpty().WithMessage("Katılımcı seçimi zorunludur.");
        RuleFor(x => x.EventId).NotEmpty().WithMessage("Etkinlik seçimi zorunludur.");

        RuleFor(x => x.Status).Must(Statuses.Contains).WithMessage("Geçersiz başvuru durumu.");
        RuleFor(x => x.DocumentStatus).Must(DocumentStatuses.Contains).WithMessage("Geçersiz belge durumu.");
        RuleFor(x => x.PaymentStatus).Must(PaymentStatuses.Contains).WithMessage("Geçersiz ödeme durumu.");
    }
}
