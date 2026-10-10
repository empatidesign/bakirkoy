using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Participants;

public static class ParticipantEndpoints
{
    public static IEndpointRouteBuilder MapParticipantEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/participants")
            .WithTags("Participants")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("participants.view");
        group.MapGet("/summary", GetSummary).RequirePermission("participants.view");

        group.MapGet("/demographics", GetDemographicsOverview).RequirePermission("participants.view");
        group.MapGet("/demographics/neighborhood/{neighborhood}", GetNeighborhoodDetail).RequirePermission("participants.view");

        group.MapGet("/{id:guid}", GetById).RequirePermission("participants.view");
        group.MapPost("/nvi-lookup", NviLookup).RequirePermission("participants.view");
        group.MapGet("/by-tckn/{tckn}", LookupByTckn).RequirePermission("participants.view");
        group.MapPost("/", Create).RequirePermission("participants.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("participants.edit");
        group.MapPost("/{id:guid}/nvi-refresh", RefreshFromNvi).RequirePermission("participants.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("participants.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("participants.edit");
        group.MapPatch("/{id:guid}/status", SetStatus).RequirePermission("participants.edit");
        group.MapPost("/{id:guid}/send-password-reset", SendPasswordReset).RequirePermission("participants.edit");
        group.MapPost("/{id:guid}/set-password", SetManualPassword).RequirePermission("participants.edit");
        group.MapPatch("/{id:guid}/admin-notes", async (Guid id, UpdateAdminNotesRequest req, IParticipantService svc, CancellationToken ct) =>
        {
            await svc.UpdateAdminNotesAsync(id, req.Notes, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("participants.edit");
        group.MapPost("/{id:guid}/unlock", Unlock).RequirePermission("participants.edit");
        group.MapGet("/{id:guid}/appointment-key", async (Guid id, IParticipantService svc, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await svc.GetAppointmentKeyAsync(id, ct)))).RequirePermission("participants.view");
        group.MapPost("/{id:guid}/appointment-key", async (Guid id, IParticipantService svc, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await svc.GenerateAppointmentKeyAsync(id, ct)))).RequirePermission("participants.edit");
        group.MapDelete("/{id:guid}/appointment-key", async (Guid id, IParticipantService svc, CancellationToken ct) =>
        {
            await svc.RevokeAppointmentKeyAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("participants.edit");
        group.MapGet("/{id:guid}/surveys", GetSurveyHistory).RequirePermission("participants.view")
            .WithSummary("Katılımcının anket geçmişi")
            .WithDescription("Bir katılımcının yanıtladığı anketleri kategori, yanıt tarihi ve anket başlığıyla döner. Anonim anketlerde yalnızca katılım bilgisi görünür, verdiği cevaplar kimliğiyle eşleştirilmez.");
        group.MapGet("/{id:guid}/notifications", GetNotifications).RequirePermission("participants.view");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] ParticipantListParams p,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? gender,
        bool? verified,
        DateTime? startDate,
        DateTime? endDate,
        Guid? guardianId,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new ParticipantListParams
            {
                Search = search,
                Gender = gender,
                Verified = verified,
                StartDate = startDate,
                EndDate = endDate,
                GuardianId = guardianId,
            }, ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> GetDemographicsOverview(
        string? status,
        bool? verified,
        DateTime? startDate,
        DateTime? endDate,
        Nexora.Application.Features.Participants.IParticipantDemographicsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOverviewAsync(
            new Nexora.Application.Features.Participants.Dtos.ParticipantDemographicsParams
            {
                Status = status,
                Verified = verified,
                StartDate = startDate,
                EndDate = endDate,
            }, ct)));

    private static async Task<IResult> GetNeighborhoodDetail(
        string neighborhood,
        string? status,
        bool? verified,
        DateTime? startDate,
        DateTime? endDate,
        int? page,
        int? limit,
        Nexora.Application.Features.Participants.IParticipantDemographicsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetNeighborhoodDetailAsync(
            Uri.UnescapeDataString(neighborhood),
            new Nexora.Application.Features.Participants.Dtos.ParticipantDemographicsParams
            {
                Status = status,
                Verified = verified,
                StartDate = startDate,
                EndDate = endDate,
            },
            page is > 0 ? page.Value : 1,
            limit is > 0 ? limit.Value : 20,
            ct)));

    private static async Task<IResult> NviLookup(
        NviLookupRequest req,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.NviLookupAsync(req, ct)));

    private static async Task<IResult> LookupByTckn(
        string tckn,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.LookupByTcknAsync(tckn, ct)));

    private static async Task<IResult> Create(
        CreateParticipantRequest req,
        IParticipantService service,
        IValidator<CreateParticipantRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/participants/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateParticipantRequest req,
        IParticipantService service,
        IValidator<UpdateParticipantRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> RefreshFromNvi(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RefreshFromNviAsync(id, ct)));

    private static async Task<IResult> Unlock(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.UnlockAsync(id, ct)));

    private static async Task<IResult> GetSurveyHistory(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSurveyHistoryAsync(id, ct)));

    private static async Task<IResult> GetNotifications(
        Guid id,
        [AsParameters] ParticipantNotificationListParams p,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetNotificationsAsync(id, p, ct)));

    private static async Task<IResult> Delete(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> SetStatus(
        Guid id,
        SetStatusRequest req,
        IParticipantService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetStatusAsync(id, req, ct)));

    private static async Task<IResult> SendPasswordReset(
        Guid id,
        SendPasswordResetRequest req,
        IParticipantService service,
        IValidator<SendPasswordResetRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SendPasswordResetAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SetManualPassword(
        Guid id,
        SetManualPasswordRequest req,
        IParticipantService service,
        IValidator<SetManualPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SetManualPasswordAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
