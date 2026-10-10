using FluentValidation;

namespace Nexora.Application.Common;

// FluentValidation zincirlerinde tekrar tekrar aynı .Must(...).WithMessage(...) kalıbını
// yazmamak için ortak uzantı metodu. Bkz. TextSafetyRules için gerekçe.
public static class TextSafetyValidationExtensions
{
    public static IRuleBuilderOptions<T, string> MustNotContainHtmlArtifacts<T>(
        this IRuleBuilder<T, string> ruleBuilder, string fieldLabel)
        => ruleBuilder
            .Must(TextSafetyRules.IsFreeOfHtmlArtifacts)
            .WithMessage($"{fieldLabel}{TextSafetyRules.ErrorMessageSuffix}");

    public static IRuleBuilderOptions<T, string?> MustNotContainHtmlArtifactsOptional<T>(
        this IRuleBuilder<T, string?> ruleBuilder, string fieldLabel)
        => ruleBuilder
            .Must(TextSafetyRules.IsFreeOfHtmlArtifacts)
            .WithMessage($"{fieldLabel}{TextSafetyRules.ErrorMessageSuffix}");
}
