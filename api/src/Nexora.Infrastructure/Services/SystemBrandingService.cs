using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.SystemBranding;
using Nexora.Application.Features.SystemBranding.Dtos;
using Nexora.Domain.Entities.SystemBranding;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SystemBrandingService(
    IUnitOfWork uow,
    IFileStorageService fileStorage,
    IActivityLogger log,
    IAuditService audit) : ISystemBrandingService
{
    private const string LogoBucket = "nexora-public";
    private const string LogoKeyPrefix = "system-branding/logo";
    private const string HorizontalLogoKeyPrefix = "system-branding/logo-horizontal";
    private const long MaxLogoSizeBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml",
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp", ".svg",
    };

    public async Task<SystemBrandingDto> GetAsync(CancellationToken ct)
        => ToDto(await GetOrCreateAsync(ct));

    public async Task<UploadSystemLogoResult> UploadLogoAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        log.LogStep(nameof(UploadLogoAsync), new { fileName, contentType });

        EnsureSafeImage(fileName, contentType, stream.Length);

        var branding = await GetOrCreateAsync(ct);
        var previousObjectName = branding.LogoObjectName;

        var upload = await fileStorage.UploadAsync(stream, fileName, contentType, LogoBucket, ct, keyPrefix: LogoKeyPrefix);
        branding.SetLogo(upload.Url, upload.ObjectName);
        uow.SystemBranding.Update(branding);
        await uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(previousObjectName) && previousObjectName != upload.ObjectName)
        {
            try { await fileStorage.DeleteAsync(previousObjectName, LogoBucket, ct); }
            catch { }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(Nexora.Domain.Entities.SystemBranding.SystemBranding),
            EntityId = branding.Id,
            Module = "SystemBranding",
            Description = "Sistem logosu güncellendi (Ayarlar bölümünden yüklendi)",
        }, ct);

        return new UploadSystemLogoResult(upload.ObjectName, upload.Url);
    }

    public async Task<SystemBrandingDto> RemoveLogoAsync(CancellationToken ct)
    {
        var branding = await GetOrCreateAsync(ct);
        var previousObjectName = branding.LogoObjectName;

        branding.ClearLogo();
        uow.SystemBranding.Update(branding);
        await uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(previousObjectName))
        {
            try { await fileStorage.DeleteAsync(previousObjectName, LogoBucket, ct); }
            catch { }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(Nexora.Domain.Entities.SystemBranding.SystemBranding),
            EntityId = branding.Id,
            Module = "SystemBranding",
            Description = "Sistem logosu kaldırıldı, varsayılan logoya dönüldü",
        }, ct);

        return ToDto(branding);
    }

    public async Task<UploadSystemLogoResult> UploadHorizontalLogoAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        log.LogStep(nameof(UploadHorizontalLogoAsync), new { fileName, contentType });

        EnsureSafeImage(fileName, contentType, stream.Length);

        var branding = await GetOrCreateAsync(ct);
        var previousObjectName = branding.HorizontalLogoObjectName;

        var upload = await fileStorage.UploadAsync(stream, fileName, contentType, LogoBucket, ct, keyPrefix: HorizontalLogoKeyPrefix);
        branding.SetHorizontalLogo(upload.Url, upload.ObjectName);
        uow.SystemBranding.Update(branding);
        await uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(previousObjectName) && previousObjectName != upload.ObjectName)
        {
            try { await fileStorage.DeleteAsync(previousObjectName, LogoBucket, ct); }
            catch { }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(Nexora.Domain.Entities.SystemBranding.SystemBranding),
            EntityId = branding.Id,
            Module = "SystemBranding",
            Description = "Yatay logo güncellendi (Ayarlar bölümünden yüklendi)",
        }, ct);

        return new UploadSystemLogoResult(upload.ObjectName, upload.Url);
    }

    public async Task<SystemBrandingDto> RemoveHorizontalLogoAsync(CancellationToken ct)
    {
        var branding = await GetOrCreateAsync(ct);
        var previousObjectName = branding.HorizontalLogoObjectName;

        branding.ClearHorizontalLogo();
        uow.SystemBranding.Update(branding);
        await uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(previousObjectName))
        {
            try { await fileStorage.DeleteAsync(previousObjectName, LogoBucket, ct); }
            catch { }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(Nexora.Domain.Entities.SystemBranding.SystemBranding),
            EntityId = branding.Id,
            Module = "SystemBranding",
            Description = "Yatay logo kaldırıldı",
        }, ct);

        return ToDto(branding);
    }

    private static void EnsureSafeImage(string fileName, string? contentType, long sizeBytes)
    {
        if (sizeBytes <= 0)
            throw new ConflictException("Görsel dosyası boş olamaz.", "FILE_REQUIRED");
        if (sizeBytes > MaxLogoSizeBytes)
            throw new ConflictException("Logo dosyası 5 MB'tan büyük olamaz.", "FILE_TOO_LARGE");

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
            throw new ConflictException("Logo yalnızca PNG, JPG, WEBP veya SVG formatında olabilir.", "UNSAFE_FILE_TYPE");

        if (string.IsNullOrWhiteSpace(contentType) || !AllowedContentTypes.Contains(contentType))
            throw new ConflictException("Logo yalnızca PNG, JPG, WEBP veya SVG formatında olabilir.", "UNSAFE_FILE_TYPE");
    }

    private async Task<Nexora.Domain.Entities.SystemBranding.SystemBranding> GetOrCreateAsync(CancellationToken ct)
    {
        var branding = await uow.SystemBranding.GetSingletonAsync(ct);
        if (branding is not null)
            return branding;

        branding = Nexora.Domain.Entities.SystemBranding.SystemBranding.CreateDefault();
        await uow.SystemBranding.AddAsync(branding, ct);
        await uow.SaveChangesAsync(ct);
        return branding;
    }

    private static SystemBrandingDto ToDto(Nexora.Domain.Entities.SystemBranding.SystemBranding b)
        => new(b.LogoUrl, b.HorizontalLogoUrl, b.UpdatedAt);
}
