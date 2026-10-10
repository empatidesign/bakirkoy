using FluentValidation;
using Nexora.Application.Common;
using Nexora.Domain.Common;
using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Application.Features.Surveys.Validators;

public static class SurveyValidationRules
{
    public static readonly string[] Statuses = ["draft", "active", "completed", "archived"];
    public static readonly string[] TargetAudiences =
        ["all", "event_participants", "event_attendees", "travel_participants",
         "facility_participants", "facility_attendees", "sports_participants", "library_users", "youth"];
    public static readonly string[] QuestionTypes =
        ["rating", "emoji_rating", "like_dislike", "satisfaction", "agreement", "multiple_choice", "checkbox", "yes_no", "scale", "text"];
    public static readonly string[] OptionTypes = ["multiple_choice", "checkbox"];
}

public class SurveyQuestionRequestValidator : AbstractValidator<SurveyQuestionRequest>
{
    public SurveyQuestionRequestValidator()
    {
        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Soru metni zorunludur.")
            .MaximumLength(500).WithMessage("Soru metni 500 karakteri aşamaz.");

        RuleFor(x => x.Type)
            .Must(t => SurveyValidationRules.QuestionTypes.Contains(t)).WithMessage("Geçersiz soru tipi.");

        RuleFor(x => x.Options)
            .Must(o => o != null && o.Count(s => !string.IsNullOrWhiteSpace(s)) >= 2)
            .When(x => SurveyValidationRules.OptionTypes.Contains(x.Type))
            .WithMessage("Bu soru tipi için en az iki seçenek girilmelidir.");
    }
}

public class CreateSurveyRequestValidator : AbstractValidator<CreateSurveyRequest>
{
    public CreateSurveyRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Anket başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Anket başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Anket başlığı");

        RuleFor(x => x.Category)
            .MaximumLength(100).WithMessage("Kategori 100 karakteri aşamaz.");

        RuleFor(x => x.TargetAudience)
            .Must(t => SurveyValidationRules.TargetAudiences.Contains(t)).WithMessage("Geçersiz hedef kitle seçimi.");

        RuleFor(x => x.EstimatedDuration)
            .InclusiveBetween(1, 60).WithMessage("Tahmini süre 1 ile 60 dakika arasında olmalıdır.");

        RuleFor(x => x.StartDate)
            .Must(d => !d.HasValue || d.Value >= TurkeyTime.TodayStartUtc())
            .WithMessage("Geçmiş tarih girilemez.");

        RuleFor(x => x.EndDate)
            .Must((req, end) => !end.HasValue || !req.StartDate.HasValue || end.Value.Date >= req.StartDate.Value.Date)
            .WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.Questions)
            .NotEmpty().WithMessage("Ankete en az bir soru eklenmelidir.");

        RuleForEach(x => x.Questions).SetValidator(new SurveyQuestionRequestValidator());
    }
}

public class UpdateSurveyRequestValidator : AbstractValidator<UpdateSurveyRequest>
{
    public UpdateSurveyRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Anket başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Anket başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Anket başlığı");

        RuleFor(x => x.Category)
            .MaximumLength(100).WithMessage("Kategori 100 karakteri aşamaz.");

        RuleFor(x => x.TargetAudience)
            .Must(t => SurveyValidationRules.TargetAudiences.Contains(t)).WithMessage("Geçersiz hedef kitle seçimi.");

        RuleFor(x => x.EstimatedDuration)
            .InclusiveBetween(1, 60).WithMessage("Tahmini süre 1 ile 60 dakika arasında olmalıdır.");

        RuleFor(x => x.EndDate)
            .Must((req, end) => !end.HasValue || !req.StartDate.HasValue || end.Value.Date >= req.StartDate.Value.Date)
            .WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.Questions)
            .NotEmpty().WithMessage("Ankete en az bir soru eklenmelidir.");

        RuleForEach(x => x.Questions).SetValidator(new SurveyQuestionRequestValidator());
    }
}
