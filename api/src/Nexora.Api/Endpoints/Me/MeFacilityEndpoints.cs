using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.ParticipantFacilities;
using Nexora.Application.Features.ParticipantFacilities.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeFacilityEndpoints
{
    public static IEndpointRouteBuilder MapMeFacilityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/facilities")
            .WithTags("MeFacilities")
            .RequireAuthorization("Citizen");

        group.MapGet("/applications", GetApplications);
        // Misafir (giriş yapmamış) kullanıcı programları görebilmeli — etkinliklerdeki gibi.
        // Servisler kullanıcı yoksa uygunluk/başvuru bilgisini boş bırakır; başvuru hâlâ giriş ister.
        group.MapGet("/{module}/discover", Discover).AllowAnonymous();
        group.MapGet("/{module}/branches", GetBranches).AllowAnonymous();
        group.MapGet("/{module}/filters", GetFilters).AllowAnonymous();
        group.MapGet("/{module}/groups/{groupId:guid}", GetDetail).AllowAnonymous();
        group.MapPost("/{module}/groups/{groupId:guid}/apply", Apply);
        group.MapPost("/{module}/documents", UploadDocument).DisableAntiforgery();
        group.MapDelete("/applications/{id:guid}", CancelApplication);
        group.MapGet("/turnstile-qr", GetTurnstileQr);
        group.MapGet("/{module}/turnstile-qr", GetTurnstileQrForModule);
        group.MapPost("/static-scan", ScanStaticQr);

        return app;
    }

    private static async Task<IResult> ScanStaticQr(
        ScanFacilityStaticQrPayload payload,
        IFacilityAttendanceService service,
        Nexora.Application.Common.Interfaces.ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ScanStaticQrAsync(payload.Code, participantId, ct, payload.Latitude, payload.Longitude);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetTurnstileQr(IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTurnstileQrAsync(null, ct)));

    private static async Task<IResult> GetTurnstileQrForModule(string module, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTurnstileQrAsync(module, ct)));

    private static async Task<IResult> Discover(string module, [AsParameters] CitizenFacilityDiscoverParams p, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DiscoverAsync(module, p, ct)));

    private static async Task<IResult> GetBranches(string module, Guid? participantId, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetBranchesAsync(module, participantId, ct)));

    private static async Task<IResult> GetFilters(string module, [AsParameters] CitizenFacilityDiscoverParams p, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetFiltersAsync(module, p, ct)));

    private static async Task<IResult> GetDetail(string module, Guid groupId, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(module, groupId, ct)));

    private static async Task<IResult> Apply(string module, Guid groupId, CitizenFacilityApplyRequest req, IParticipantFacilityService service, CancellationToken ct)
    {
        var result = await service.ApplyAsync(module, groupId, req ?? new CitizenFacilityApplyRequest(null), ct);
        return Results.Created($"/api/v1/me/facilities/applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UploadDocument(string module, Guid? groupId, string? documentType, IFormFile file, IParticipantFacilityService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Lütfen bir belge seçin.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadDocumentAsync(module, groupId, stream, file.FileName, file.ContentType, ct, documentType);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetApplications([AsParameters] CitizenFacilityApplicationListParams p, IParticipantFacilityService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetApplicationsAsync(p, ct)));

    private static async Task<IResult> CancelApplication(Guid id, IParticipantFacilityService service, CancellationToken ct)
    {
        await service.CancelApplicationAsync(id, ct);
        // Bkz. MeLibraryEndpoints.CancelReservation (madde 68) — iptal uçları boş 204 yerine
        // istemcinin gösterebileceği bir onay mesajı döner.
        return Results.Ok(ApiResponse.Ok(new { id, cancelled = true, message = "Başvurunuz iptal edildi." }));
    }
}

public record ScanFacilityStaticQrPayload(string Code, double? Latitude = null, double? Longitude = null);
