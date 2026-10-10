using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.MobileConfig.Dtos;

namespace Nexora.Application.Features.MobileConfig.Validators;

public class UpdateMobileWebViewRequestValidator : AbstractValidator<UpdateMobileWebViewRequest>
{
    public UpdateMobileWebViewRequestValidator()
    {
        When(x => x.Enabled, () =>
        {
            RuleFor(x => x.Url)
                .NotEmpty().WithMessage("Webview modu için portal adresi zorunludur.")
                .Must(BeHttpsUrl).WithMessage("Portal adresi geçerli bir https adresi olmalıdır.");
        });

        RuleFor(x => x.MaxVersion)
            .Matches(@"^\d+(\.\d+){0,2}$")
            .WithMessage("Sürüm 1.2.3 biçiminde olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.MaxVersion));

        RuleFor(x => x.Message)
            .MaximumLength(500).WithMessage("Mesaj en fazla 500 karakter olabilir.");
    }

    private static bool BeHttpsUrl(string? url)
        => Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps;
}

public class UpdateVersionControlRequestValidator : AbstractValidator<UpdateVersionControlRequest>
{
    private const string VersionPattern = @"^\d+(\.\d+){0,3}$";

    public UpdateVersionControlRequestValidator()
    {
        RuleFor(x => x.AndroidMinVersion).Matches(VersionPattern)
            .WithMessage("Android zorunlu sürüm 1.2.3 biçiminde olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.AndroidMinVersion));

        RuleFor(x => x.AndroidLatestVersion).Matches(VersionPattern)
            .WithMessage("Android güncel sürüm 1.2.3 biçiminde olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.AndroidLatestVersion));

        RuleFor(x => x.IosMinVersion).Matches(VersionPattern)
            .WithMessage("iOS zorunlu sürüm 1.2.3 biçiminde olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.IosMinVersion));

        RuleFor(x => x.IosLatestVersion).Matches(VersionPattern)
            .WithMessage("iOS güncel sürüm 1.2.3 biçiminde olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.IosLatestVersion));

        // Zorunlu sürüm, güncel sürümü aşarsa store'daki en yeni sürümü indiren
        // kullanıcı bile güncelleme ekranında kilitli kalırdı.
        RuleFor(x => x)
            .Must(x => MinNotAboveLatest(x.AndroidMinVersion, x.AndroidLatestVersion))
            .WithName(nameof(UpdateVersionControlRequest.AndroidMinVersion))
            .WithMessage("Android zorunlu sürüm, güncel sürümden büyük olamaz.");

        RuleFor(x => x)
            .Must(x => MinNotAboveLatest(x.IosMinVersion, x.IosLatestVersion))
            .WithName(nameof(UpdateVersionControlRequest.IosMinVersion))
            .WithMessage("iOS zorunlu sürüm, güncel sürümden büyük olamaz.");

        RuleFor(x => x.AndroidStoreUrl).Must(BeHttpsUrl)
            .WithMessage("Android mağaza adresi geçerli bir https adresi olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.AndroidStoreUrl));

        RuleFor(x => x.IosStoreUrl).Must(BeHttpsUrl)
            .WithMessage("iOS mağaza adresi geçerli bir https adresi olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.IosStoreUrl));

        RuleFor(x => x.UpdateMessage).MaximumLength(500)
            .WithMessage("Güncelleme mesajı en fazla 500 karakter olabilir.");

        RuleFor(x => x.UpdateReleaseNotes).MaximumLength(4000)
            .WithMessage("Sürüm notları en fazla 4000 karakter olabilir.");
    }

    private static bool MinNotAboveLatest(string? min, string? latest)
    {
        if (string.IsNullOrWhiteSpace(min) || string.IsNullOrWhiteSpace(latest))
            return true;
        if (!SemanticVersion.TryParse(min, out _) || !SemanticVersion.TryParse(latest, out _))
            return true; // Biçim hatasını kendi kuralları bildirir.
        return SemanticVersion.IsAtMost(min, latest);
    }

    private static bool BeHttpsUrl(string? url)
        => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

public class UpdateSplashImageRequestValidator : AbstractValidator<UpdateSplashImageRequest>
{
    public UpdateSplashImageRequestValidator()
    {
        // Boş değer görseli kaldırır (uygulama paketli logosuna döner), bu yüzden geçerlidir.
        RuleFor(x => x.ImageUrl)
            .MaximumLength(1000)
            .Must(BeUploadedOrHttpsUrl)
            .WithMessage("Görsel adresi yüklenen bir dosya yolu veya https adresi olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl));
    }

    /// <summary>
    /// Yükleme ucu göreli bir yol döner (/api/v1/files/public/...), bu yüzden
    /// yalnız https şartı koşulamaz. Dışarıdan elle girilen adreslerde ise
    /// https zorunludur: düz http, uygulamanın görseli güvensiz kanaldan
    /// çekmesine yol açardı.
    /// </summary>
    internal static bool BeUploadedOrHttpsUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return true;
        var value = url.Trim();

        if (value.StartsWith("/api/v1/files/public/", StringComparison.OrdinalIgnoreCase))
            return true;

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
    }
}

public class UpdateMobileLogoRequestValidator : AbstractValidator<UpdateMobileLogoRequest>
{
    public UpdateMobileLogoRequestValidator()
    {
        RuleFor(x => x.ImageUrl)
            .MaximumLength(1000)
            .Must(UpdateSplashImageRequestValidator.BeUploadedOrHttpsUrl)
            .WithMessage("Görsel adresi yüklenen bir dosya yolu veya https adresi olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl));
    }
}

public class UpdateOnboardingImagesRequestValidator : AbstractValidator<UpdateOnboardingImagesRequest>
{
    public const int MaxImageCount = 20;

    public UpdateOnboardingImagesRequestValidator()
    {
        RuleFor(x => x.ImageUrls)
            .NotNull().WithMessage("Görsel listesi zorunludur.")
            .Must(x => x.Count <= MaxImageCount)
            .WithMessage($"En fazla {MaxImageCount} tanıtım görseli eklenebilir.");

        RuleForEach(x => x.ImageUrls)
            .NotEmpty()
            .MaximumLength(1000)
            .Must(UpdateSplashImageRequestValidator.BeUploadedOrHttpsUrl)
            .WithMessage("Görsel adresi yüklenen bir dosya yolu veya https adresi olmalıdır.");
    }
}

public class UpdateLegalDocumentsRequestValidator : AbstractValidator<UpdateLegalDocumentsRequest>
{
    public UpdateLegalDocumentsRequestValidator()
    {
        RuleFor(x => x.CitizenKvkk).NotEmpty().MaximumLength(20000);
        RuleFor(x => x.CitizenNotification).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.CompanyKvkk).NotEmpty().MaximumLength(20000);
        RuleFor(x => x.CompanyNotification).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.CompanyStaffKvkk).NotEmpty().MaximumLength(20000);
        RuleFor(x => x.CompanyStaffNotification).NotEmpty().MaximumLength(10000);
    }
}

public class SaveMobileQuickActionRequestValidator : AbstractValidator<SaveMobileQuickActionRequest>
{
    public SaveMobileQuickActionRequestValidator()
    {
        RuleFor(x => x.Target)
            .NotEmpty().WithMessage("Yönlendirme hedefi zorunludur.")
            .Must(MobileQuickActionTargets.IsKnown)
            .WithMessage("Seçilen yönlendirme hedefi uygulamada tanımlı değil.");

        RuleFor(x => x.Label).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Icon).NotEmpty().MaximumLength(64);

        RuleFor(x => x.Color)
            .NotEmpty()
            .Matches("^#[0-9a-fA-F]{6}$")
            .WithMessage("Renk #RRGGBB biçiminde olmalıdır.");

        // "Web adresi aç" / "telefon ara" hedefleri kendi adresi olmadan
        // anlamsızdır; adres istemeyen hedeflerde ise alan boş bırakılabilir.
        When(x => MobileQuickActionTargets.IsManualScreen(x.Target), () =>
        {
            RuleFor(x => x.TargetUrl)
                .NotEmpty().WithMessage("Yönlendirilecek ekranın adı zorunludur.")
                .MaximumLength(64)
                .Matches("^[A-Za-z][A-Za-z0-9_]*$")
                .WithMessage("Ekran adı harfle başlamalı; yalnızca harf, rakam ve alt çizgi içerebilir.");
        });

        When(x => MobileQuickActionTargets.RequiresUrl(x.Target)
                  && !MobileQuickActionTargets.IsManualScreen(x.Target), () =>
        {
            RuleFor(x => x.TargetUrl)
                .NotEmpty().WithMessage("Bu hedef için bir adres veya telefon numarası zorunludur.")
                .MaximumLength(1000);
        });
    }
}

public class ReorderMobileQuickActionsRequestValidator : AbstractValidator<ReorderMobileQuickActionsRequest>
{
    public ReorderMobileQuickActionsRequestValidator()
    {
        RuleFor(x => x.OrderedIds)
            .NotNull().WithMessage("Sıralama listesi zorunludur.")
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithMessage("Sıralama listesinde tekrar eden kart var.");
    }
}
