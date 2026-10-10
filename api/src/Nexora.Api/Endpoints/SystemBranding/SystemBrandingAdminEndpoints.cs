using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.SystemBranding;

namespace Nexora.Api.Endpoints.SystemBranding;

public static class SystemBrandingAdminEndpoints
{
    public static IEndpointRouteBuilder MapSystemBrandingAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/system-branding")
            .WithTags("SystemBranding")
            .RequireAuthorization();

        group.MapGet("/", async (ISystemBrandingService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetAsync(ct))))
            .RequirePermission("system-branding.view");

        group.MapPost("/logo", async (IFormFile? file, ISystemBrandingService s, CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                throw new ConflictException("Lütfen bir logo dosyası seçin.", "FILE_REQUIRED");

            await using var stream = file.OpenReadStream();
            var result = await s.UploadLogoAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(result));
        }).DisableAntiforgery().RequirePermission("system-branding.manage");

        group.MapDelete("/logo", async (ISystemBrandingService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.RemoveLogoAsync(ct))))
            .RequirePermission("system-branding.manage");

        group.MapPost("/logo-horizontal", async (IFormFile? file, ISystemBrandingService s, CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                throw new ConflictException("Lütfen bir logo dosyası seçin.", "FILE_REQUIRED");

            await using var stream = file.OpenReadStream();
            var result = await s.UploadHorizontalLogoAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(result));
        }).DisableAntiforgery().RequirePermission("system-branding.manage");

        group.MapDelete("/logo-horizontal", async (ISystemBrandingService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.RemoveHorizontalLogoAsync(ct))))
            .RequirePermission("system-branding.manage");

        return app;
    }
}
