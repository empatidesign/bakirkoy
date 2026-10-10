using FluentValidation;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes.Validators;

public class QuizQuestionRequestValidator : AbstractValidator<QuizQuestionRequest>
{
    private static readonly string[] Difficulties = ["kolay", "orta", "zor", "uzman"];

    public QuizQuestionRequestValidator()
    {
        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Soru metni zorunludur.")
            .MaximumLength(500).WithMessage("Soru metni 500 karakteri aşamaz.");

        RuleFor(x => x.Options)
            .NotNull().WithMessage("Seçenekler zorunludur.")
            .Must(o => o is { Count: >= 2 }).WithMessage("En az 2 seçenek girilmelidir.")
            .Must(o => o is not null && o.All(s => !string.IsNullOrWhiteSpace(s))).WithMessage("Tüm seçenekler doldurulmalıdır.");

        RuleFor(x => x.CorrectAnswer)
            .GreaterThanOrEqualTo(0).WithMessage("Doğru cevap seçilmelidir.")
            .Must((req, idx) => req.Options is not null && idx < req.Options.Count).WithMessage("Doğru cevap geçerli bir seçenek olmalıdır.");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Soru kategorisi zorunludur.");

        RuleFor(x => x.Difficulty)
            .Must(d => Difficulties.Contains(d)).WithMessage("Geçersiz zorluk seviyesi.");

        RuleFor(x => x.Points)
            .InclusiveBetween(1, 100).WithMessage("Puan 1 ile 100 arasında olmalıdır.");

        RuleFor(x => x.TimeLimit)
            .InclusiveBetween(5, 300).WithMessage("Süre 5 ile 300 saniye arasında olmalıdır.");
    }
}

public class SaveQuizQuestionsRequestValidator : AbstractValidator<SaveQuizQuestionsRequest>
{
    public SaveQuizQuestionsRequestValidator()
    {
        RuleFor(x => x.Questions)
            .NotEmpty().WithMessage("En az bir soru eklenmelidir.");

        RuleForEach(x => x.Questions).SetValidator(new QuizQuestionRequestValidator());
    }
}
