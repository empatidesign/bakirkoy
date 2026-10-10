using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.MobileMenu.Dtos;
using Nexora.Domain.Enums;

namespace Nexora.Application.Features.MobileMenu.Validators;

public class CreateMobileMenuItemRequestValidator : AbstractValidator<CreateMobileMenuItemRequest>
{
    public CreateMobileMenuItemRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .MaximumLength(20).WithMessage("Renk değeri geçersiz.");

        RuleFor(x => x.ColorSecondary)
            .MaximumLength(20).WithMessage("İkinci renk değeri geçersiz.");

        RuleFor(x => x.Description)
            .MaximumLength(200).WithMessage("Açıklama 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Açıklama")
            .When(x => !string.IsNullOrWhiteSpace(x.Description));

        RuleFor(x => x.LinkTarget)
            .NotEmpty().WithMessage("Link hedefi zorunludur.")
            .MaximumLength(1000).WithMessage("Link hedefi çok uzun.");

        RuleFor(x => x.LinkTarget)
            .Must(MobileMenuValidatorHelpers.BeAbsoluteUrl)
            .WithMessage("WebView/Dış URL için geçerli bir http(s) adresi girin.")
            .When(x => x.LinkType is MenuLinkType.WebView or MenuLinkType.ExternalUrl);

        RuleFor(x => x.GroupKey)
            .NotEmpty().WithMessage("Grup anahtarı zorunludur.")
            .MaximumLength(60).WithMessage("Grup anahtarı 60 karakteri aşamaz.");

        RuleFor(x => x.GroupTitle)
            .NotEmpty().WithMessage("Grup başlığı zorunludur.")
            .MaximumLength(120).WithMessage("Grup başlığı 120 karakteri aşamaz.");
    }
}

public class UpdateMobileMenuItemRequestValidator : AbstractValidator<UpdateMobileMenuItemRequest>
{
    public UpdateMobileMenuItemRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık zorunludur.")
            .MaximumLength(120).WithMessage("Başlık 120 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon zorunludur.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .MaximumLength(20).WithMessage("Renk değeri geçersiz.");

        RuleFor(x => x.ColorSecondary)
            .MaximumLength(20).WithMessage("İkinci renk değeri geçersiz.");

        RuleFor(x => x.Description)
            .MaximumLength(200).WithMessage("Açıklama 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Açıklama")
            .When(x => !string.IsNullOrWhiteSpace(x.Description));

        RuleFor(x => x.LinkTarget)
            .NotEmpty().WithMessage("Link hedefi zorunludur.")
            .MaximumLength(1000).WithMessage("Link hedefi çok uzun.");

        RuleFor(x => x.LinkTarget)
            .Must(MobileMenuValidatorHelpers.BeAbsoluteUrl)
            .WithMessage("WebView/Dış URL için geçerli bir http(s) adresi girin.")
            .When(x => x.LinkType is MenuLinkType.WebView or MenuLinkType.ExternalUrl);

        RuleFor(x => x.GroupKey)
            .NotEmpty().WithMessage("Grup anahtarı zorunludur.")
            .MaximumLength(60).WithMessage("Grup anahtarı 60 karakteri aşamaz.");

        RuleFor(x => x.GroupTitle)
            .NotEmpty().WithMessage("Grup başlığı zorunludur.")
            .MaximumLength(120).WithMessage("Grup başlığı 120 karakteri aşamaz.");
    }
}

internal static class MobileMenuValidatorHelpers
{
    internal static bool BeAbsoluteUrl(string? url)
        => Uri.TryCreate(url, UriKind.Absolute, out var u)
           && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);
}

public class UpsertBannerRequestValidator : AbstractValidator<UpsertBannerRequest>
{
    public UpsertBannerRequestValidator()
    {
        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithMessage("Banner görseli zorunludur.")
            .MaximumLength(1000).WithMessage("Görsel adresi çok uzun.");

        RuleFor(x => x.LinkTarget)
            .NotEmpty().WithMessage("Seçtiğiniz link tipi için hedef zorunludur.")
            .When(x => x.LinkType != BannerLinkType.None);
    }
}
