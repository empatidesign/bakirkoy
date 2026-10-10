using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes.Validators;

public class CreateQuizAgeGroupRequestValidator : AbstractValidator<CreateQuizAgeGroupRequest>
{
    public CreateQuizAgeGroupRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Yaş grubu adı zorunludur.")
            .MaximumLength(100).WithMessage("Yaş grubu adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Yaş grubu adı");

        RuleFor(x => x.MinAge)
            .GreaterThanOrEqualTo(0).WithMessage("En küçük yaş negatif olamaz.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(0).WithMessage("En büyük yaş negatif olamaz.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(x => x.MinAge)
            .WithMessage("En büyük yaş, en küçük yaştan küçük olamaz.")
            .When(x => x.MaxAge > 0);

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0).WithMessage("Sıra değeri negatif olamaz.");
    }
}

public class UpdateQuizAgeGroupRequestValidator : AbstractValidator<UpdateQuizAgeGroupRequest>
{
    public UpdateQuizAgeGroupRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Yaş grubu adı zorunludur.")
            .MaximumLength(100).WithMessage("Yaş grubu adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Yaş grubu adı");

        RuleFor(x => x.MinAge)
            .GreaterThanOrEqualTo(0).WithMessage("En küçük yaş negatif olamaz.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(0).WithMessage("En büyük yaş negatif olamaz.");

        RuleFor(x => x.MaxAge)
            .GreaterThanOrEqualTo(x => x.MinAge)
            .WithMessage("En büyük yaş, en küçük yaştan küçük olamaz.")
            .When(x => x.MaxAge > 0);

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0).WithMessage("Sıra değeri negatif olamaz.");
    }
}
