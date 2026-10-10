using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.CitizenSubmissions;

public static class CitizenSubmissionEndpoints
{
    public static IEndpointRouteBuilder MapCitizenSubmissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/citizen-submissions")
            .WithTags("CitizenSubmissions")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("muhtarlik.view");
        group.MapGet("/summary", GetSummary).RequirePermission("muhtarlik.view");
        group.MapGet("/map-points", GetMapPoints).RequirePermission("muhtarlik.view");
        group.MapGet("/reports-summary", GetReports).RequirePermission("muhtarlik.view");
        group.MapGet("/neighborhoods", GetNeighborhoods).RequirePermission("muhtarlik.view");
        group.MapGet("/muhtar-assignments", GetMuhtarAssignments).RequirePermission("muhtarlik.view");
        group.MapPost("/neighborhoods/{neighborhood}/provision-muhtar", ProvisionMuhtar).RequirePermission("admins.create");
        group.MapGet("/{id:guid}", GetById).RequirePermission("muhtarlik.view");
        group.MapPatch("/{id:guid}/status", UpdateStatus).RequirePermission("muhtarlik.edit");
        group.MapPost("/{id:guid}/forward", Forward).RequirePermission("muhtarlik.edit");
        group.MapPost("/{id:guid}/reset-forward-state", ResetForwardState).RequirePermission("muhtarlik.edit");
        group.MapPatch("/{id:guid}/notify-muhtar", ToggleNotify).RequirePermission("muhtarlik.edit");
        group.MapPost("/muhtar-create", CreateByMuhtar).RequirePermission("muhtarlik.edit");
        group.MapPost("/muhtar-nvi-lookup", MuhtarNviLookup).RequirePermission("muhtarlik.edit");
        group.MapPost("/muhtar-media", UploadMuhtarMedia).RequirePermission("muhtarlik.edit").DisableAntiforgery();

        var muhtarlikGroup = app.MapGroup("/api/v1/muhtarlik")
            .WithTags("CitizenSubmissions")
            .RequireAuthorization("AdminOrAbove");
        muhtarlikGroup.MapPost("/messages/send", SendMessage).RequirePermission("muhtarlik.edit");
        muhtarlikGroup.MapGet("/notification-settings", GetNotificationSettings).RequirePermission("muhtarlik.view");
        muhtarlikGroup.MapPut("/notification-settings", SaveNotificationSettings).RequirePermission("muhtarlik.edit");

        // Kullanıcı isteği (2026-08-28): muhtarın kendi panelinde mahallesindeki tüm süreci
        // (kimlik bilgisi olmadan) görebileceği detaylı dashboard.
        muhtarlikGroup.MapGet("/dashboard", GetMuhtarDashboard).RequirePermission("muhtarlik.view");
        muhtarlikGroup.MapGet("/submissions/{id:guid}/process", GetMuhtarProcess).RequirePermission("muhtarlik.view");
        muhtarlikGroup.MapPost("/submissions/{id:guid}/opinion", AddMuhtarOpinion).RequirePermission("muhtarlik.edit");

        return app;
    }

    private static async Task<IResult> GetMuhtarDashboard(
        string? neighborhood, string? dateRange, IMuhtarDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDashboardAsync(neighborhood, dateRange, ct)));

    private static async Task<IResult> GetMuhtarProcess(Guid id, IMuhtarDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(id, ct)));

    private static async Task<IResult> AddMuhtarOpinion(
        Guid id, MuhtarOpinionRequest req, IMuhtarDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.AddOpinionAsync(id, req, ct)));

    private static async Task<IResult> GetList(
        [AsParameters] CitizenSubmissionListParams p,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        [AsParameters] CitizenSubmissionListParams p,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(p, ct)));

    private static async Task<IResult> GetMapPoints(
        [AsParameters] CitizenSubmissionListParams p,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMapPointsAsync(p, ct)));

    private static async Task<IResult> GetReports(
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetReportsSummaryAsync(ct)));

    private static async Task<IResult> GetNeighborhoods(
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetNeighborhoodOptionsAsync(ct)));

    private static async Task<IResult> GetMuhtarAssignments(
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMuhtarAssignmentsAsync(ct)));

    private static async Task<IResult> ProvisionMuhtar(
        string neighborhood,
        ProvisionMuhtarRequest req,
        ICitizenSubmissionService service,
        IValidator<ProvisionMuhtarRequest> validator,
        CancellationToken ct)
    {
        // Denetim düzeltmesi (2026-09-01): DB kolon sınırını (FullName/Phone/Email) aşan girdi
        // önceden yakalanmamış 500 veriyordu — bkz. ProvisionMuhtarRequestValidator.
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.ProvisionMuhtarAsync(Uri.UnescapeDataString(neighborhood), req, ct)));
    }

    private static async Task<IResult> GetById(
        Guid id,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> UpdateStatus(
        Guid id,
        UpdateSubmissionStatusRequest req,
        ICitizenSubmissionService service,
        IValidator<UpdateSubmissionStatusRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateStatusAsync(id, req.Status, req.Note, ct)));
    }

    private static async Task<IResult> Forward(
        Guid id,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ForwardAsync(id, ct)));

    private static async Task<IResult> ResetForwardState(
        Guid id,
        ResetForwardStateRequest req,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ResetUlakbelForwardStateAsync(id, req.Reason, ct)));

    private static async Task<IResult> ToggleNotify(
        Guid id,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleNotifyMuhtarAsync(id, ct)));

    private static async Task<IResult> CreateByMuhtar(
        CreateSubmissionByMuhtarRequest req,
        ICitizenSubmissionService service,
        IValidator<CreateSubmissionByMuhtarRequest> validator,
        CancellationToken ct)
    {
        // Denetim düzeltmesi (2026-09-01): DB kolon sınırını (Title/Description/Address) aşan
        // girdi önceden yakalanmamış 500 veriyordu — bkz. CreateSubmissionByMuhtarRequestValidator.
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Created(await service.CreateByMuhtarAsync(req, ct)));
    }

    private static async Task<IResult> MuhtarNviLookup(
        MuhtarNviLookupRequest req,
        ICitizenSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.MuhtarNviLookupAsync(req, ct)));

    private static async Task<IResult> UploadMuhtarMedia(
        IFormFile file,
        ICitizenSubmissionService service,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new Nexora.Application.Common.Exceptions.ConflictException("Lütfen bir fotoğraf veya video seçin.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadMuhtarMediaAsync(stream, file.FileName, file.ContentType, file.Length, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> SendMessage(ModuleManualMessageRequest req, ICitizenSubmissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));

    private static async Task<IResult> GetNotificationSettings(IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync("muhtarlik", ct)));

    private static async Task<IResult> SaveNotificationSettings(
        ModuleNotificationSettingsDto req,
        IModuleNotificationSettingsService service,
        ICitizenSubmissionService submissionService,
        CancellationToken ct)
    {
        // Denetim düzeltmesi (2026-09-01, KRİTİK): bkz. CitizenSubmissionService.
        // EnsureCanManageGlobalNotificationSettingsAsync — tek mahalleye scope'lu bir muhtarın
        // TÜM mahalleleri etkileyen global SMS/bildirim şablonunu değiştirmesini engeller.
        await submissionService.EnsureCanManageGlobalNotificationSettingsAsync(ct);
        return Results.Ok(ApiResponse.Ok(await service.SaveAsync("muhtarlik", req, ct)));
    }
}
