using FluentValidation;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events.Validators;

public class SessionFormRequestValidator : AbstractValidator<SessionFormRequest>
{
    public SessionFormRequestValidator()
    {
        RuleFor(x => x.EventId).NotEmpty().WithMessage("Etkinlik seçimi zorunludur.");

        When(x => x.Mode == "recurring", () =>
        {
            RuleFor(x => x.DayPlans).NotEmpty().WithMessage("En az bir gün ve saat aralığı eklemelisiniz.");
            RuleForEach(x => x.DayPlans).ChildRules(plan =>
            {
                plan.RuleFor(p => p.Slots).NotEmpty().WithMessage("Her gün için en az bir saat aralığı gerekir.");
                // 2026-08-02 kullanıcı bildirimi: tekrarlı seans üretiminde de her gün için
                // saat aralıklarında bitişin başlangıçtan sonra olduğu kontrol edilmiyordu.
                plan.RuleForEach(p => p.Slots)
                    .Must(s => TimeOnly.TryParse(s.EndTime, out var end) && TimeOnly.TryParse(s.StartTime, out var start) && end > start)
                    .WithMessage("Bitiş saati başlangıç saatinden sonra olmalıdır.");
            });
            RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
                .WithMessage("Bitiş tarihi başlangıçtan önce olamaz.");
        });

        When(x => x.Mode != "recurring", () =>
        {
            RuleFor(x => x.StartTime).NotEmpty().WithMessage("Başlangıç saati zorunludur.");
            RuleFor(x => x.EndTime).NotEmpty().WithMessage("Bitiş saati zorunludur.");

            // 2026-08-02 kullanıcı bildirimi: tek seans oluştururken bitiş saati başlangıçtan
            // önce/eşit seçilebiliyordu, hiçbir doğrulama yoktu.
            RuleFor(x => x.EndTime)
                .Must((r, endTime) => TimeOnly.TryParse(endTime, out var end) && TimeOnly.TryParse(r.StartTime, out var start) && end > start)
                .WithMessage("Bitiş saati başlangıç saatinden sonra olmalıdır.")
                .When(x => !string.IsNullOrWhiteSpace(x.StartTime) && !string.IsNullOrWhiteSpace(x.EndTime));
        });

        RuleFor(x => x.Instructor)
            .NotEmpty().WithMessage("Eğitmen adı zorunludur.")
            .When(IsNewPersonGrant);

        RuleFor(x => x.InstructorEmail)
            .NotEmpty().WithMessage("Eğitmen e-postası zorunludur.")
            .EmailAddress().WithMessage("Geçerli bir e-posta adresi giriniz.")
            .When(IsNewPersonGrant);
    }

    private static bool IsNewPersonGrant(SessionFormRequest r)
        => r.GrantAccess && !(Guid.TryParse(r.InstructorId, out var g) && g != Guid.Empty);
}
