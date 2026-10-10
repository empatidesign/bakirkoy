using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryTemplateEndpoints
{
    public static IEndpointRouteBuilder MapLibraryTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/library-templates")
            .WithTags("Libraries")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetAll).RequirePermission("library.view");

        group.MapGet("/shadow-audit", ShadowAuditAll).RequirePermission("library.view");
        group.MapGet("/shadow-audit/{libraryId:guid}", ShadowAuditOne).RequirePermission("library.view");

        group.MapGet("/{id}", GetById).RequirePermission("library.view");

        return app;
    }

    private static async Task<IResult> ShadowAuditAll(ITemplateShadowAuditService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.AuditAllAsync(ct)));

    private static async Task<IResult> ShadowAuditOne(Guid libraryId, ITemplateShadowAuditService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.AuditAsync(libraryId, ct)));

    private static IResult GetAll()
        => Results.Ok(ApiResponse.Ok(OperationTemplates.All));

    private static IResult GetById(string id)
    {
        var template = OperationTemplates.Find(id);
        return template is null
            ? Results.NotFound(ApiResponse.Fail(404, "Şablon bulunamadı.", "TEMPLATE_NOT_FOUND"))
            : Results.Ok(ApiResponse.Ok(template));
    }
}
