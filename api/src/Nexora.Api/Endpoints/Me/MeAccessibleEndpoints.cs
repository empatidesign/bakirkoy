using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.AccessibleApplications;
using Nexora.Application.Features.AccessibleApplications.Dtos;

namespace Nexora.Api.Endpoints.Me;

// IDN-Engelsiz (2026-09-11): mobil AccessibleApplicationDetailScreen için
// eklendi. Önceden bu ekran /api/v1/me/accessible/* çağırıyordu ama bu
// route grubu hiç yoktu (404) — ekran tamamen işlevsizdi. Route'lar mobil
// tarafın ENDPOINTS.me.accessible* sabitleriyle birebir eşleşecek şekilde
// tanımlanmıştır (bkz. sultansehir-app src/api/endpoints.ts).
public static class MeAccessibleEndpoints
{
    public static IEndpointRouteBuilder MapMeAccessibleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/accessible")
            .WithTags("MeAccessible")
            .RequireAuthorization("Citizen");

        group.MapGet("/applications/{id:guid}", GetSummary);
        group.MapPost("/applications/{id:guid}/disability-info", SubmitDisabilityInfo);
        group.MapPost("/applications/{id:guid}/kvkk-consent", GiveKvkkConsent);
        group.MapGet("/applications/{id:guid}/progress-notes", GetProgressNotes);
        group.MapPost("/caregivers", DefineCaregiver);

        return app;
    }

    private static Guid RequireParticipantId(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

    private static async Task<IResult> GetSummary(
        Guid id, IAccessibleApplicationService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.GetSummaryAsync(id, RequireParticipantId(currentUser), ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> SubmitDisabilityInfo(
        Guid id, SubmitDisabilityInfoRequest req, IAccessibleApplicationService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.SubmitDisabilityInfoAsync(id, RequireParticipantId(currentUser), req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GiveKvkkConsent(
        Guid id, GiveKvkkConsentRequest req, IAccessibleApplicationService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.GiveKvkkConsentAsync(id, RequireParticipantId(currentUser), req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetProgressNotes(
        Guid id, IAccessibleApplicationService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.GetProgressNotesAsync(id, RequireParticipantId(currentUser), ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> DefineCaregiver(
        DefineCaregiverRequest req, IAccessibleApplicationService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.DefineCaregiverAsync(RequireParticipantId(currentUser), req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
