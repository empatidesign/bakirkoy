using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries.Validators;

public class LibraryRuleRequestValidator : AbstractValidator<LibraryRuleRequest>
{
    public LibraryRuleRequestValidator()
    {
        RuleFor(x => x.Category)
            .Must(v => v is "general" or "silent" or "team" or "food" or "device")
            .WithMessage("Kategori geçersiz.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(200).WithMessage("Başlık 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama zorunludur.")
            .MaximumLength(1000).WithMessage("Açıklama 1000 karakteri aşamaz.");

        RuleFor(x => x.Severity)
            .Must(v => v is "info" or "warning" or "rule")
            .WithMessage("Önem düzeyi geçersiz.");
    }
}
