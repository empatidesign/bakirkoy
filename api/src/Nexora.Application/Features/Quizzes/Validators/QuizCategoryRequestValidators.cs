using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes.Validators;

public class CreateQuizCategoryRequestValidator : AbstractValidator<CreateQuizCategoryRequest>
{
    public CreateQuizCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kategori adı zorunludur.")
            .MaximumLength(100).WithMessage("Kategori adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kategori adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .Matches("^#[0-9a-fA-F]{6}$").WithMessage("Renk #RRGGBB biçiminde olmalıdır.");
    }
}

public class UpdateQuizCategoryRequestValidator : AbstractValidator<UpdateQuizCategoryRequest>
{
    public UpdateQuizCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kategori adı zorunludur.")
            .MaximumLength(100).WithMessage("Kategori adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kategori adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .Matches("^#[0-9a-fA-F]{6}$").WithMessage("Renk #RRGGBB biçiminde olmalıdır.");
    }
}
