using FluentValidation;
using Nexora.Application.Features.ParticipantQuizzes.Dtos;

namespace Nexora.Application.Features.ParticipantQuizzes.Validators;

public class CitizenQuizSubmitRequestValidator : AbstractValidator<CitizenQuizSubmitRequest>
{
    public CitizenQuizSubmitRequestValidator()
    {
        RuleFor(x => x.Answers)
            .NotNull().WithMessage("Cevap listesi zorunludur.");

        RuleFor(x => x.TotalTimeSpent)
            .GreaterThanOrEqualTo(0).WithMessage("Geçen süre negatif olamaz.");

        RuleForEach(x => x.Answers).ChildRules(answer =>
        {
            answer.RuleFor(a => a.QuestionIndex)
                .GreaterThanOrEqualTo(0).WithMessage("Geçersiz soru numarası gönderildi.");

            answer.RuleFor(a => a.SelectedAnswer)
                .MaximumLength(500).WithMessage("Cevap metni çok uzun.");

            answer.RuleFor(a => a.TimeSpent)
                .GreaterThanOrEqualTo(0).WithMessage("Soru süresi negatif olamaz.");
        });
    }
}
