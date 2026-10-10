using Microsoft.Extensions.Options;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.MobileConfig;
using Nexora.Application.Features.MobileConfig.Dtos;
using Nexora.Domain.Entities.MobileConfig;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class MobileConfigService(
    IUnitOfWork uow,
    IFileStorageService storage,
    IOptionsMonitor<MinioSettings> minioOptions,
    IActivityLogger log,
    IAuditService audit,
    IMobileConfigRealtimeNotifier realtime) : IMobileConfigService
{
    public async Task<MobileAppConfigDto> GetForClientAsync(
        string? clientVersion, MobilePlatform? platform, CancellationToken ct)
    {
        var config = await GetOrCreateAsync(ct);

        var enabled = config.WebViewEnabled
            && !string.IsNullOrWhiteSpace(config.WebViewUrl)
            && MatchesVersionRule(config.WebViewMaxVersion, clientVersion);

        return new MobileAppConfigDto(
            new MobileWebViewDto(enabled, enabled ? config.WebViewUrl : null, enabled ? config.WebViewMessage : null),
            ToLegalDocumentsDto(config),
            EvaluateVersion(config, clientVersion, platform),
            new MobileSplashDto(config.SplashImageUrl),
            new MobileLogosDto(config.HomeLogoUrl, config.TabBarLogoUrl),
            await GetClientQuickActionsAsync(ct),
            config.OnboardingImageUrls);
    }

    public async Task<MobileAppConfigAdminDto> GetAdminAsync(CancellationToken ct)
        => ToAdminDto(await GetOrCreateAsync(ct));

    public async Task<MobileAppConfigAdminDto> UpdateWebViewAsync(UpdateMobileWebViewRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateWebViewAsync), new { req.Enabled, req.MaxVersion });

        var config = await GetOrCreateAsync(ct);
        config.UpdateWebView(req.Enabled, req.Url, req.MaxVersion, req.Message);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description = req.Enabled
                ? $"Mobil webview modu AÇILDI (url: {config.WebViewUrl}, maxVersion: {config.WebViewMaxVersion ?? "-"})"
                : "Mobil webview modu KAPATILDI",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);

        return ToAdminDto(config);
    }

    public async Task<MobileAppConfigAdminDto> UpdateVersionControlAsync(
        UpdateVersionControlRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateVersionControlAsync), new { req.AndroidMinVersion, req.IosMinVersion });

        var config = await GetOrCreateAsync(ct);
        config.UpdateVersionControl(
            req.AndroidMinVersion, req.AndroidLatestVersion, req.AndroidStoreUrl,
            req.IosMinVersion, req.IosLatestVersion, req.IosStoreUrl,
            req.UpdateMessage, req.UpdateReleaseNotes);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description =
                $"Mobil sürüm kontrolü güncellendi (Android min: {config.AndroidMinVersion ?? "-"}, "
                + $"son: {config.AndroidLatestVersion ?? "-"}; iOS min: {config.IosMinVersion ?? "-"}, "
                + $"son: {config.IosLatestVersion ?? "-"})",
        }, ct);

        return ToAdminDto(config);
    }

    public async Task<MobileAppConfigAdminDto> UpdateSplashImageAsync(
        UpdateSplashImageRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateSplashImageAsync), new { req.ImageUrl });

        var config = await GetOrCreateAsync(ct);
        var previousUrl = config.SplashImageUrl;
        config.UpdateSplashImage(req.ImageUrl);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(previousUrl) && previousUrl != config.SplashImageUrl)
        {
            var previousObjectName = Nexora.Infrastructure.Storage.FileUrl.ObjectNameFromUrl(previousUrl);
            if (!string.IsNullOrWhiteSpace(previousObjectName))
            {
                try { await storage.DeleteAsync(previousObjectName, minioOptions.CurrentValue.PublicBucket, ct); }
                catch { }
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description = config.SplashImageUrl is null
                ? "Açılış ekranı görseli kaldırıldı"
                : $"Açılış ekranı görseli güncellendi: {config.SplashImageUrl}",
        }, ct);

        return ToAdminDto(config);
    }

    public Task<MobileAppConfigAdminDto> UpdateHomeLogoAsync(UpdateMobileLogoRequest req, CancellationToken ct)
        => UpdateLogoAsync(
            req,
            c => c.HomeLogoUrl,
            (c, url) => c.UpdateHomeLogo(url),
            "Ana sayfa logosu",
            ct);

    public Task<MobileAppConfigAdminDto> UpdateTabBarLogoAsync(UpdateMobileLogoRequest req, CancellationToken ct)
        => UpdateLogoAsync(
            req,
            c => c.TabBarLogoUrl,
            (c, url) => c.UpdateTabBarLogo(url),
            "Alt menü logosu",
            ct);

    private async Task<MobileAppConfigAdminDto> UpdateLogoAsync(
        UpdateMobileLogoRequest req,
        Func<MobileAppConfig, string?> read,
        Action<MobileAppConfig, string?> write,
        string label,
        CancellationToken ct)
    {
        var config = await GetOrCreateAsync(ct);
        var previousUrl = read(config);

        write(config, req.ImageUrl);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        var currentUrl = read(config);
        if (!string.IsNullOrWhiteSpace(previousUrl) && previousUrl != currentUrl)
        {
            var previousObjectName = Nexora.Infrastructure.Storage.FileUrl.ObjectNameFromUrl(previousUrl);
            if (!string.IsNullOrWhiteSpace(previousObjectName))
            {
                try { await storage.DeleteAsync(previousObjectName, minioOptions.CurrentValue.PublicBucket, ct); }
                catch { }
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description = currentUrl is null
                ? $"{label} kaldırıldı"
                : $"{label} güncellendi: {currentUrl}",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);

        return ToAdminDto(config);
    }

    public async Task<MobileAppConfigAdminDto> UpdateOnboardingImagesAsync(
        UpdateOnboardingImagesRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateOnboardingImagesAsync), new { Count = req.ImageUrls.Count });

        var config = await GetOrCreateAsync(ct);
        var previousUrls = config.OnboardingImageUrls.ToList();
        config.UpdateOnboardingImages(req.ImageUrls);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        foreach (var removed in previousUrls.Except(config.OnboardingImageUrls))
        {
            var objectName = Nexora.Infrastructure.Storage.FileUrl.ObjectNameFromUrl(removed);
            if (string.IsNullOrWhiteSpace(objectName)) continue;
            try { await storage.DeleteAsync(objectName, minioOptions.CurrentValue.PublicBucket, ct); }
            catch { }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description = $"Tanıtım görselleri güncellendi ({config.OnboardingImageUrls.Count} görsel)",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);

        return ToAdminDto(config);
    }

    public async Task<string> UploadOnboardingImageAsync(
        Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var converted = await WebpImageConverter.ConvertAsync(stream, fileName, contentType, ct);
        try
        {
            var result = await storage.UploadAsync(
                converted.Stream, converted.FileName, converted.ContentType, bucket, ct, keyPrefix: "mobile-onboarding");
            return result.Url;
        }
        finally
        {
            if (converted.OwnsStream) await converted.Stream.DisposeAsync();
        }
    }

    public async Task<string> UploadLogoAsync(
        Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var converted = await WebpImageConverter.ConvertAsync(stream, fileName, contentType, ct);
        try
        {
            var result = await storage.UploadAsync(
                converted.Stream, converted.FileName, converted.ContentType, bucket, ct, keyPrefix: "mobile-logo");
            return result.Url;
        }
        finally
        {
            if (converted.OwnsStream) await converted.Stream.DisposeAsync();
        }
    }

    public async Task<string> UploadSplashImageAsync(
        Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var converted = await WebpImageConverter.ConvertAsync(stream, fileName, contentType, ct);
        try
        {
            var result = await storage.UploadAsync(
                converted.Stream, converted.FileName, converted.ContentType, bucket, ct, keyPrefix: "mobile-splash");
            return result.Url;
        }
        finally
        {
            if (converted.OwnsStream) await converted.Stream.DisposeAsync();
        }
    }

    public async Task<MobileAppConfigAdminDto> UpdateLegalDocumentsAsync(UpdateLegalDocumentsRequest req, CancellationToken ct)
    {
        var config = await GetOrCreateAsync(ct);
        config.UpdateLegalDocuments(
            req.CitizenKvkk, req.CitizenNotification,
            req.CompanyKvkk, req.CompanyNotification,
            req.CompanyStaffKvkk, req.CompanyStaffNotification);
        uow.MobileAppConfigs.Update(config);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileAppConfig),
            EntityId = config.Id,
            Module = "MobileConfig",
            Description = "KVKK ve bildirim izni metinleri güncellendi",
        }, ct);

        return ToAdminDto(config);
    }

    // ---- Hızlı işlem kartları ----

    /// <summary>
    /// İstemciye yalnızca aktif ve TANINAN hedefli kartlar gider. Panelde
    /// bir hedef yanlışlıkla geçersiz hale gelirse kart listeden düşer;
    /// kullanıcı dokununca hiçbir şey olmayan ölü bir kart görmez.
    /// </summary>
    private async Task<IReadOnlyList<MobileQuickActionDto>> GetClientQuickActionsAsync(CancellationToken ct)
    {
        var items = await uow.MobileQuickActions.GetOrderedAsync(ct);
        return items
            .Where(x => x.IsActive && MobileQuickActionTargets.IsKnown(x.Target))
            .Where(x => !MobileQuickActionTargets.RequiresUrl(x.Target) || !string.IsNullOrWhiteSpace(x.TargetUrl))
            .Select(x => new MobileQuickActionDto(x.Target, x.Label, x.Icon, x.Color, x.RequiresAuth, x.TargetUrl))
            .ToList();
    }

    public async Task<IReadOnlyList<MobileQuickActionAdminDto>> GetQuickActionsAsync(CancellationToken ct)
        => (await uow.MobileQuickActions.GetOrderedAsync(ct)).Select(ToQuickActionDto).ToList();

    public async Task<MobileQuickActionAdminDto> CreateQuickActionAsync(
        SaveMobileQuickActionRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateQuickActionAsync), new { req.Target, req.Label });

        // Yeni kart en sona eklenir; sıralama ayrı uçtan değiştirilir.
        var existing = await uow.MobileQuickActions.GetOrderedAsync(ct);

        if (req.IsActive && existing.Count(x => x.IsActive) >= MobileQuickAction.MaxActiveCount)
            throw new ConflictException(ActiveLimitMessage);

        var sortOrder = existing.Count == 0 ? 10 : existing.Max(x => x.SortOrder) + 10;

        var item = MobileQuickAction.Create(
            req.Target, req.Label, req.Icon, req.Color,
            sortOrder, req.IsActive, req.RequiresAuth, req.TargetUrl);

        await uow.MobileQuickActions.AddAsync(item, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = nameof(MobileQuickAction),
            EntityId = item.Id,
            Module = "MobileConfig",
            Description = $"Hızlı işlem kartı eklendi: {item.Label} → {item.Target}",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);
        return ToQuickActionDto(item);
    }

    public async Task<MobileQuickActionAdminDto> UpdateQuickActionAsync(
        Guid id, SaveMobileQuickActionRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateQuickActionAsync), new { id, req.Target });

        var item = await uow.MobileQuickActions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hızlı işlem kartı bulunamadı.");

        // Pasif bir kartı aktife çevirmek de sınırı aşabilir.
        if (req.IsActive && !item.IsActive)
        {
            var activeCount = await uow.MobileQuickActions.CountAsync(x => x.IsActive, ct);
            if (activeCount >= MobileQuickAction.MaxActiveCount)
                throw new ConflictException(ActiveLimitMessage);
        }

        item.Apply(
            req.Target, req.Label, req.Icon, req.Color,
            item.SortOrder, req.IsActive, req.RequiresAuth, req.TargetUrl);

        uow.MobileQuickActions.Update(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileQuickAction),
            EntityId = item.Id,
            Module = "MobileConfig",
            Description = $"Hızlı işlem kartı güncellendi: {item.Label} → {item.Target}"
                + (item.IsActive ? string.Empty : " (pasif)"),
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);
        return ToQuickActionDto(item);
    }

    public async Task DeleteQuickActionAsync(Guid id, CancellationToken ct)
    {
        var item = await uow.MobileQuickActions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hızlı işlem kartı bulunamadı.");

        uow.MobileQuickActions.Delete(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = nameof(MobileQuickAction),
            EntityId = item.Id,
            Module = "MobileConfig",
            Description = $"Hızlı işlem kartı silindi: {item.Label}",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);
    }

    public async Task<IReadOnlyList<MobileQuickActionAdminDto>> ReorderQuickActionsAsync(
        ReorderMobileQuickActionsRequest req, CancellationToken ct)
    {
        var items = await uow.MobileQuickActions.GetOrderedAsync(ct);
        var byId = items.ToDictionary(x => x.Id);

        // Listede olmayan bir id gönderilmişse sıralama eksik uygulanır ve
        // kartlar sessizce karışır; baştan reddet.
        var unknown = req.OrderedIds.FirstOrDefault(id => !byId.ContainsKey(id));
        if (unknown != Guid.Empty)
            throw new NotFoundException("Sıralanan kartlardan biri bulunamadı.");

        var order = 10;
        foreach (var id in req.OrderedIds)
        {
            byId[id].SetSortOrder(order);
            order += 10;
        }

        // İstekte yer almayan kartlar (ör. eşzamanlı eklenmiş) sona alınır.
        foreach (var item in items.Where(x => !req.OrderedIds.Contains(x.Id)))
        {
            item.SetSortOrder(order);
            order += 10;
        }

        uow.MobileQuickActions.UpdateRange(items);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(MobileQuickAction),
            EntityId = MobileAppConfig.SingletonId,
            Module = "MobileConfig",
            Description = "Hızlı işlem kartlarının sırası değiştirildi",
        }, ct);

        await realtime.NotifyConfigChangedAsync(ct);

        return items.OrderBy(x => x.SortOrder).Select(ToQuickActionDto).ToList();
    }

    private static string ActiveLimitMessage =>
        $"En fazla {MobileQuickAction.MaxActiveCount} kart aktif olabilir. "
        + "Yeni bir kart eklemek için önce mevcut kartlardan birini pasife alın.";

    private static MobileQuickActionAdminDto ToQuickActionDto(MobileQuickAction x)
        => new(x.Id, x.Target, x.Label, x.Icon, x.Color, x.SortOrder,
            x.IsActive, x.RequiresAuth, x.TargetUrl, x.UpdatedAt);

    private static MobileVersionCheckDto EvaluateVersion(
        MobileAppConfig config, string? clientVersion, MobilePlatform? platform)
    {
        var (minVersion, latestVersion, storeUrl) = platform switch
        {
            MobilePlatform.Android => (config.AndroidMinVersion, config.AndroidLatestVersion, config.AndroidStoreUrl),
            MobilePlatform.Ios => (config.IosMinVersion, config.IosLatestVersion, config.IosStoreUrl),
            _ => (null, null, null),
        };

        var status = platform is null
            ? MobileUpdateStatus.UpToDate
            : MobileUpdateDecision.Evaluate(clientVersion, minVersion, latestVersion);

        return new MobileVersionCheckDto(
            status,
            latestVersion,
            minVersion,
            storeUrl,
            status == MobileUpdateStatus.UpToDate ? null : config.UpdateMessage,
            status == MobileUpdateStatus.UpToDate ? null : config.UpdateReleaseNotes);
    }

    private static bool MatchesVersionRule(string? maxVersion, string? clientVersion)
    {
        if (string.IsNullOrWhiteSpace(maxVersion))
            return false;

        if (!SemanticVersion.TryParse(clientVersion, out _))
            return true;

        return SemanticVersion.IsAtMost(clientVersion, maxVersion);
    }

    private async Task<MobileAppConfig> GetOrCreateAsync(CancellationToken ct)
    {
        var config = await uow.MobileAppConfigs.GetSingletonAsync(ct);
        if (config is not null)
            return config;

        config = MobileAppConfig.CreateDefault();
        await uow.MobileAppConfigs.AddAsync(config, ct);
        await uow.SaveChangesAsync(ct);
        return config;
    }

    private static MobileAppConfigAdminDto ToAdminDto(MobileAppConfig c)
        => new(
            c.WebViewEnabled, c.WebViewUrl, c.WebViewMaxVersion, c.WebViewMessage,
            c.AndroidMinVersion, c.AndroidLatestVersion, c.AndroidStoreUrl,
            c.IosMinVersion, c.IosLatestVersion, c.IosStoreUrl,
            c.UpdateMessage, c.UpdateReleaseNotes, c.SplashImageUrl,
            c.HomeLogoUrl, c.TabBarLogoUrl, c.OnboardingImageUrls,
            ToLegalDocumentsDto(c), c.UpdatedAt);

    private static LegalDocumentsDto ToLegalDocumentsDto(MobileAppConfig c)
        => new(
            c.CitizenKvkkText, c.CitizenNotificationText,
            c.CompanyKvkkText, c.CompanyNotificationText,
            c.CompanyStaffKvkkText, c.CompanyStaffNotificationText);
}
