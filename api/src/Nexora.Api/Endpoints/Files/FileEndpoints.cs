using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Api.Endpoints.Files;

public static class FileEndpoints
{
    public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/files/public/{**objectName}", GetPublic).AllowAnonymous();
        app.MapGet("/api/v1/files/private/{**objectName}", GetPrivate).RequireAuthorization();
        return app;
    }

    private static Task<IResult> GetPublic(
        string objectName, HttpContext http, [FromServices] IFileStorageService storage, [FromServices] IOptions<MinioSettings> minio, CancellationToken ct)
        => StreamObject(objectName, minio.Value.PublicBucket, "public, max-age=604800, immutable", http, storage, ct);

    private static async Task<IResult> GetPrivate(
        string objectName, HttpContext http, [FromServices] IFileStorageService storage, [FromServices] IOptions<MinioSettings> minio,
        [FromServices] ICurrentUser currentUser, [FromServices] IUserScopeService userScope, [FromServices] IAuditService audit, CancellationToken ct)
    {
        var authorized = await IsPrivateDocumentAccessAuthorizedAsync(objectName, currentUser, userScope, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.View,
            EntityType = "PrivateDocument",
            Module = "Files",
            Description = authorized ? $"Özel evrak görüntülendi: {objectName}" : $"Özel evraka yetkisiz erişim reddedildi: {objectName}",
            Result = authorized ? LogResult.Success : LogResult.Failure,
            Level = authorized ? AuditLogLevel.Info : AuditLogLevel.Warning,
        }, ct);

        if (!authorized)
            return Results.Forbid();

        return await StreamObject(objectName, minio.Value.PrivateBucket, "private, no-store", http, storage, ct);
    }

    private static async Task<bool> IsPrivateDocumentAccessAuthorizedAsync(
        string objectName, ICurrentUser currentUser, IUserScopeService userScope, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin) return true;

        var segments = objectName.Split('/', StringSplitOptions.RemoveEmptyEntries);

        // bakkart/{participantId}/{dosya} — BakkartService.UploadMyDocumentAsync bu düzende yükler.
        if (segments.Length >= 3 && string.Equals(segments[0], "bakkart", StringComparison.OrdinalIgnoreCase))
        {
            if (!Guid.TryParse(segments[1], out var bakkartOwnerId)) return false;
            if (currentUser.Role is not null) return true;
            return currentUser.Id.HasValue && currentUser.Id.Value == bakkartOwnerId;
        }

        var isFacilityModulePath = segments.Length >= 3 &&
            Nexora.Application.Features.Facilities.FacilityModuleRegistry.IsValid(segments[0]);
        if (!isFacilityModulePath) return false;

        if (!Guid.TryParse(segments[2], out var ownerParticipantId))
            return false;

        if (currentUser.Role is not null)
        {
            if (currentUser.Id is null) return false;
            var scopedParticipantIds = await userScope.GetScopedParticipantIdsAsync(currentUser.Id.Value, ct);
            return scopedParticipantIds is null || scopedParticipantIds.Contains(ownerParticipantId);
        }

        return currentUser.Id.HasValue && currentUser.Id.Value == ownerParticipantId;
    }

    // #5b: bu liste artık SafeUploadValidation.DangerousExtensions ile tek bir ortak
    // kaynaktan türetiliyor, böylece yükleme kara listesi ile sunum katmanının
    // Content-Disposition zorlaması birbirinden drift edemez (.php, .asp, .jsp vb.
    // sunucu tarafında yorumlanabilir uzantılar dahil). SVG/XML gibi tarayıcı-taraflı
    // aktif içerik uzantıları ayrıca eklenir (bunlar yükleme sırasında da zaten reddedilir
    // ama defense-in-depth için burada da inline sunulmaz).
    private static readonly HashSet<string> ActiveContentExtensions = new(
        Nexora.Application.Common.SafeUploadValidation.DangerousExtensions,
        StringComparer.OrdinalIgnoreCase)
    {
        ".svg", ".xml",
    };

    private static readonly HashSet<string> DangerousInlineContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/html", "application/xhtml+xml", "image/svg+xml", "application/xml", "text/xml",
        "application/javascript", "text/javascript", "application/x-httpd-php", "application/x-msdownload",
    };

    private static bool IsActiveContent(string objectName)
    {
        var ext = System.IO.Path.GetExtension(objectName);
        return !string.IsNullOrEmpty(ext) && ActiveContentExtensions.Contains(ext);
    }

    private static bool IsDangerousInlineContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType)) return false;
        var semi = contentType.IndexOf(';');
        var mediaType = (semi >= 0 ? contentType[..semi] : contentType).Trim();
        return DangerousInlineContentTypes.Contains(mediaType);
    }

    private static bool IsPathTraversalOrInvalid(string objectName)
    {
        if (string.IsNullOrWhiteSpace(objectName)) return true;
        var unescaped = Uri.UnescapeDataString(objectName);
        return unescaped.Contains("..") || unescaped.Contains('\\') || unescaped.Contains('\0');
    }

    private static async Task<IResult> StreamObject(
        string objectName, string bucket, string cacheControl, HttpContext http, IFileStorageService storage, CancellationToken ct)
    {
        if (IsPathTraversalOrInvalid(objectName))
            return Results.NotFound();

        var file = await storage.GetObjectAsync(objectName, bucket, ct);
        if (file is null)
            return Results.NotFound();

        http.Response.Headers.CacheControl = cacheControl;

        http.Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (IsActiveContent(objectName) || IsDangerousInlineContentType(file.ContentType))
        {
            var downloadName = System.IO.Path.GetFileName(objectName);
            http.Response.Headers["Content-Disposition"] = $"attachment; filename=\"{downloadName}\"";
        }

        return Results.Stream(file.Stream, file.ContentType);
    }
}

