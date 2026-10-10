using FluentValidation;
using Nexora.Application.Common;
using Nexora.Domain.Common;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes.Validators;

public static class QuizValidationRules
{
    public static readonly string[] Statuses = ["upcoming", "ongoing", "completed"];
    public static readonly string[] EducationLevels = ["anaokulu", "ilkokul", "ortaokul", "lise", "universite", "genel"];
}

public class CreateQuizRequestValidator : AbstractValidator<CreateQuizRequest>
{
    public CreateQuizRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Yarışma başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Yarışma başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Yarışma başlığı");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama zorunludur.")
            .MaximumLength(1000).WithMessage("Açıklama 1000 karakteri aşamaz.");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.");

        RuleFor(x => x.Status)
            .Must(s => QuizValidationRules.Statuses.Contains(s)).WithMessage("Geçersiz yarışma aşaması.");

        RuleFor(x => x.StartDate)
            .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.QuestionCount)
            .GreaterThan(0).WithMessage("Soru sayısı en az 1 olmalıdır.")
            .LessThanOrEqualTo(100).WithMessage("Soru sayısı 100'ü aşamaz.");

        RuleFor(x => x.PerQuestionTimeLimit)
            .InclusiveBetween(5, 300).WithMessage("Soru süresi 5 ile 300 saniye arasında olmalıdır.");

        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(1, 600).WithMessage("Toplam süre 1 ile 600 dakika arasında olmalıdır.");

        RuleFor(x => x.EducationLevel!)
            .Must(e => QuizValidationRules.EducationLevels.Contains(e)).WithMessage("Geçersiz eğitim seviyesi.")
            .When(x => !string.IsNullOrWhiteSpace(x.EducationLevel));

        RuleFor(x => x.PassingScore).GreaterThanOrEqualTo(0).WithMessage("Geçme puanı negatif olamaz.");
        RuleFor(x => x.MaxParticipants).GreaterThanOrEqualTo(0).WithMessage("Maksimum katılımcı negatif olamaz.");
        RuleFor(x => x.PassRights).GreaterThanOrEqualTo(0).WithMessage("Pas hakkı negatif olamaz.");
    }
}

public class UpdateQuizRequestValidator : AbstractValidator<UpdateQuizRequest>
{
    public UpdateQuizRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Yarışma başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Yarışma başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Yarışma başlığı");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama zorunludur.")
            .MaximumLength(1000).WithMessage("Açıklama 1000 karakteri aşamaz.");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.");

        RuleFor(x => x.Status)
            .Must(s => QuizValidationRules.Statuses.Contains(s)).WithMessage("Geçersiz yarışma aşaması.");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.QuestionCount)
            .GreaterThan(0).WithMessage("Soru sayısı en az 1 olmalıdır.")
            .LessThanOrEqualTo(100).WithMessage("Soru sayısı 100'ü aşamaz.");

        RuleFor(x => x.PerQuestionTimeLimit)
            .InclusiveBetween(5, 300).WithMessage("Soru süresi 5 ile 300 saniye arasında olmalıdır.");

        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(1, 600).WithMessage("Toplam süre 1 ile 600 dakika arasında olmalıdır.");

        RuleFor(x => x.EducationLevel!)
            .Must(e => QuizValidationRules.EducationLevels.Contains(e)).WithMessage("Geçersiz eğitim seviyesi.")
            .When(x => !string.IsNullOrWhiteSpace(x.EducationLevel));

        RuleFor(x => x.PassingScore).GreaterThanOrEqualTo(0).WithMessage("Geçme puanı negatif olamaz.");
        RuleFor(x => x.MaxParticipants).GreaterThanOrEqualTo(0).WithMessage("Maksimum katılımcı negatif olamaz.");
        RuleFor(x => x.PassRights).GreaterThanOrEqualTo(0).WithMessage("Pas hakkı negatif olamaz.");
    }
}
