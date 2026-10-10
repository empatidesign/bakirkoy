using FluentValidation;
using Microsoft.AspNetCore.Routing;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Facilities;

public static class FacilityModuleEndpoints
{
    public static IEndpointRouteBuilder MapFacilityModuleEndpoints(this IEndpointRouteBuilder app, string module)
    {
        var group = app.MapGroup($"/api/v1/{module}")
            .WithTags($"Facility-{module}")
            .RequireAuthorization("AdminOrAbove");

        MapFacilities(group, module);
        MapBranches(group, module);
        MapGroups(group, module);
        MapSessions(group, module);
        MapRegistrations(group, module);
        MapApplications(group, module);
        MapAttendance(group, module);
        MapDevices(group, module);
        MapSettings(group, module);
        MapReports(group, module);
        MapInstructors(group, module);
        MapMessages(group, module);

        return app;
    }

    private static void MapMessages(RouteGroupBuilder group, string module)
    {
        group.MapPost("/messages/send", async (FacilityManualMessageRequest req, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SendManualMessageAsync(module, req, ct))))
            .RequireAnyPermission("service-facilities.edit", $"{module}.edit");
    }

    private static void MapFacilities(RouteGroupBuilder group, string module)
    {
        group.MapGet("/facilities", async ([AsParameters] FacilityListParams p, IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", $"{module}.view");

        group.MapGet("/facilities/trash", async ([AsParameters] FacilityListParams p, IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetTrashAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", $"{module}.view");

        group.MapGet("/facilities/options", async (IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetOptionsAsync(module, ct)))).RequireAnyPermission("service-facilities.view", $"{module}.view");

        group.MapGet("/facilities/summary", async (IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetSummaryAsync(module, ct)))).RequireAnyPermission("service-facilities.view", $"{module}.view");

        group.MapGet("/facilities/{id:guid}", async (Guid id, IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(module, id, ct)))).RequireAnyPermission("service-facilities.view", $"{module}.view");

        group.MapPost("/facilities", async (CreateFacilityRequest req, IFacilityService svc, IValidator<CreateFacilityRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/facilities/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPut("/facilities/{id:guid}", async (Guid id, UpdateFacilityRequest req, IFacilityService svc, IValidator<UpdateFacilityRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(module, id, req, ct)));
        }).RequirePermission("service-facilities.edit");

        group.MapDelete("/facilities/{id:guid}", async (Guid id, IFacilityService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        group.MapPatch("/facilities/{id:guid}/toggle-status", async (Guid id, IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/facilities/{id:guid}/restore", async (Guid id, IFacilityService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RestoreAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapDelete("/facilities/{id:guid}/permanent", async (Guid id, IFacilityService svc, CancellationToken ct) =>
        {
            await svc.PermanentDeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        // Kullanıcı isteği (2026-10-05): tesisler ada/eklenme tarihine veya manuel sürükle-bırak
        // ile sıralanabilsin — manuel mod için ReorderWaitlistAsync ile aynı desende endpoint.
        group.MapPut("/facilities/order", async (ReorderFacilitiesRequest req, IFacilityService svc, CancellationToken ct) =>
        {
            await svc.ReorderAsync(module, req.OrderedIds ?? [], ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");
    }

    private static void MapBranches(RouteGroupBuilder group, string module)
    {
        group.MapGet("/branches", async ([AsParameters] FacilityBranchListParams p, IFacilityBranchService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/branches/trash", async ([AsParameters] FacilityBranchListParams p, IFacilityBranchService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetTrashAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/branches/options", async (IFacilityBranchService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetOptionsAsync(module, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/branches", async (CreateFacilityBranchRequest req, IFacilityBranchService svc, IValidator<CreateFacilityBranchRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/branches/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPut("/branches/{id:guid}", async (Guid id, UpdateFacilityBranchRequest req, IFacilityBranchService svc, IValidator<UpdateFacilityBranchRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(module, id, req, ct)));
        }).RequirePermission("service-facilities.edit");

        group.MapDelete("/branches/{id:guid}", async (Guid id, IFacilityBranchService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        group.MapPatch("/branches/{id:guid}/toggle-status", async (Guid id, IFacilityBranchService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/branches/bulk-category", async (BulkUpdateBranchCategoryRequest req, IFacilityBranchService svc, CancellationToken ct) =>
        {
            var count = await svc.BulkUpdateCategoryAsync(module, req.Ids, req.Category, ct);
            return Results.Ok(ApiResponse.Ok(new { updatedCount = count }));
        }).RequirePermission("service-facilities.edit");

        group.MapPatch("/branches/{id:guid}/restore", async (Guid id, IFacilityBranchService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RestoreAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapDelete("/branches/{id:guid}/permanent", async (Guid id, IFacilityBranchService svc, CancellationToken ct) =>
        {
            await svc.PermanentDeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");
    }

    private static void MapGroups(RouteGroupBuilder group, string module)
    {
        group.MapGet("/groups", async ([AsParameters] FacilityGroupListParams p, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/groups/trash", async ([AsParameters] FacilityGroupListParams p, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetTrashAsync(module, p, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/groups/options", async (Guid? facilityId, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetOptionsAsync(module, facilityId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/groups/{id:guid}", async (Guid id, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(module, id, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/groups", async (CreateFacilityGroupRequest req, IFacilityGroupService svc, IValidator<CreateFacilityGroupRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/groups/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPut("/groups/{id:guid}", async (Guid id, UpdateFacilityGroupRequest req, bool? confirmAttendanceDeletion, IFacilityGroupService svc, IValidator<UpdateFacilityGroupRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(module, id, req, confirmAttendanceDeletion ?? false, ct)));
        }).RequirePermission("service-facilities.edit");

        group.MapDelete("/groups/{id:guid}", async (Guid id, IFacilityGroupService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        group.MapPatch("/groups/{id:guid}/toggle-status", async (Guid id, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/groups/{id:guid}/restore", async (Guid id, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RestoreAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapDelete("/groups/{id:guid}/permanent", async (Guid id, IFacilityGroupService svc, CancellationToken ct) =>
        {
            await svc.PermanentDeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        group.MapGet("/groups/{id:guid}/academy-whitelist", async (Guid id, IFacilityGroupService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetAcademyWhitelistAsync(module, id, ct)))).RequirePermission("service-facilities.view");

        group.MapPut("/groups/{id:guid}/academy-whitelist", async (Guid id, List<string> tckns, IFacilityGroupService svc, CancellationToken ct) =>
        {
            await svc.SetAcademyWhitelistAsync(module, id, tckns, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");

        group.MapPost("/groups/{id:guid}/sub-groups", async (Guid id, CreateSubGroupRequest req, IFacilityGroupService svc, IValidator<CreateSubGroupRequest> v, CancellationToken ct) =>
        {
            var reqWithParent = req with { ParentGroupId = id };
            var validation = await v.ValidateAsync(reqWithParent, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateSubGroupAsync(module, reqWithParent, ct);
            return Results.Created($"/api/v1/{module}/groups/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPost("/groups/{id:guid}/copy", async (Guid id, CopyFacilityGroupRequest req, IFacilityGroupService svc, IValidator<CopyFacilityGroupRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.CopyAsync(module, id, req, ct)));
        }).RequirePermission("service-facilities.create");

        // Kullanıcı isteği (2026-10-05): gruplar VE seanslar (ParentGroupId'li alt kayıtlar) ada/
        // eklenme tarihine veya manuel sürükle-bırak ile sıralanabilsin. parentGroupId null ise
        // ana gruplar, doluysa o grubun seansları kapsamındadır (bağımsız sıralama alanları).
        group.MapPut("/groups/order", async (ReorderFacilityGroupsRequest req, IFacilityGroupService svc, CancellationToken ct) =>
        {
            await svc.ReorderAsync(module, req.FacilityId, req.ParentGroupId, req.OrderedIds ?? [], ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");
    }

    private static void MapSessions(RouteGroupBuilder group, string module)
    {
        group.MapGet("/sessions/calendar", async (Guid facilityId, int year, int month, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetCalendarAsync(module, facilityId, year, month, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/sessions", async (Guid facilityId, DateTime date, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByDayAsync(module, facilityId, date, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/sessions/by-group", async (Guid groupId, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByGroupAsync(module, groupId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/sessions/generate", async (GenerateSessionsRequest req, IFacilitySessionService svc, IValidator<GenerateSessionsRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.GenerateAsync(module, req.GroupId, ct)));
        }).RequirePermission("service-facilities.create");

        group.MapPost("/sessions", async (CreateManualSessionRequest req, IFacilitySessionService svc, IValidator<CreateManualSessionRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateManualAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/sessions/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPost("/sessions/{id:guid}/cancel", async (Guid id, CancelSessionRequest req, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.CancelAsync(module, id, req.Reason, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/sessions/{id:guid}/reopen", async (Guid id, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ReopenAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/sessions/bulk-cancel", async (BulkCancelSessionsRequest req, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.BulkCancelAsync(module, req, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/sessions/bulk-reopen", async (BulkReopenSessionsRequest req, IFacilitySessionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.BulkReopenAsync(module, req, ct)))).RequirePermission("service-facilities.edit");
    }

    private static void MapRegistrations(RouteGroupBuilder group, string module)
    {
        group.MapPost("/registrations", async (RegisterParticipantRequest req, IFacilityRegistrationService svc, IValidator<RegisterParticipantRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.RegisterAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/registrations/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.assign");

        group.MapGet("/registrations/roster", async (Guid groupId, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetRosterAsync(module, groupId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/registrations/roster/export", async (Guid groupId, IFacilityRegistrationService svc, CancellationToken ct) =>
        {
            var (content, fileName) = await svc.ExportRosterAsync(module, groupId, ct);
            return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapGet("/registrations/waitlist", async (Guid groupId, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetWaitlistAsync(module, groupId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/registrations/{id:guid}/remove", async (Guid id, RemoveRegistrationRequest req, IFacilityRegistrationService svc, CancellationToken ct) =>
        {
            await svc.RemoveAsync(module, id, req.Reason, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");

        group.MapPost("/registrations/{id:guid}/promote", async (Guid id, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.PromoteAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/registrations/{id:guid}/demote", async (Guid id, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.DemoteAsync(module, id, ct)))).RequirePermission("service-facilities.edit");

        group.MapPut("/registrations/waitlist/order", async (ReorderWaitlistRequest req, IFacilityRegistrationService svc, CancellationToken ct) =>
        {
            await svc.ReorderWaitlistAsync(module, req.GroupId, req.OrderedIds ?? [], ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");

        group.MapPost("/registrations/rebalance", async (Guid? groupId, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(new { demoted = await svc.RebalanceAsync(module, groupId, ct) }))).RequirePermission("service-facilities.edit");

        // Hata #20: RegisteredCount/WaitlistCount önbelleği periyodik (recurring) gruplarda gerçek
        // roster ile senkronize olmuyordu. Kısa vadeli düzeltme: admin-only, bu modüldeki tüm aktif
        // recurring grupların önbelleğini tek seferde yeniden hesaplayan reconciliation endpoint'i.
        group.MapPost("/registrations/reconcile-counts", async (IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(new { updated = await svc.ReconcileGroupCountsAsync(module, ct) }))).RequirePermission("service-facilities.edit");

        group.MapPost("/registrations/bulk-pre-register", async (BulkPreRegisterRequest req, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.BulkPreRegisterAsync(module, req, ct)))).RequirePermission("service-facilities.assign");

        // Kullanıcı isteği: eski kayıtları (devamsızlık hakkı + hak-ediş bitiş tarihiyle birlikte)
        // toplu aktarma alanı.
        group.MapPost("/registrations/bulk-import", async (BulkImportRegistrationRequest req, IFacilityRegistrationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.BulkImportRegistrationAsync(module, req, ct)))).RequirePermission("service-facilities.assign");
    }

    private static void MapApplications(RouteGroupBuilder group, string module)
    {
        group.MapGet("/applications", async ([AsParameters] FacilityApplicationListParams p, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(module, p, ct)))).RequirePermission("service-facilities.view");

        group.MapGet("/applications/stats", async (Guid facilityId, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetStatsAsync(module, facilityId, ct)))).RequirePermission("service-facilities.view");

        group.MapGet("/applications/{id:guid}", async (Guid id, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(module, id, ct)))).RequirePermission("service-facilities.view");

        group.MapPost("/applications", async (CreateFacilityApplicationRequest req, IFacilityApplicationService svc, IValidator<CreateFacilityApplicationRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/applications/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPost("/applications/{id:guid}/approve", async (Guid id, ApproveFacilityApplicationRequest? req, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ApproveAsync(module, id, req, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/applications/bulk-approve", async (FacilityBulkApproveRequest req, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.BulkApproveAsync(module, req, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/applications/{id:guid}/reject", async (Guid id, string? reason, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RejectAsync(module, id, reason, ct)))).RequirePermission("service-facilities.edit");

        group.MapDelete("/applications/{id:guid}", async (Guid id, IFacilityApplicationService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.edit");

        group.MapGet("/applications/{id:guid}/registration", async (Guid id, IFacilityApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(new { registrationId = await svc.GetRegistrationIdAsync(module, id, ct) }))).RequirePermission("service-facilities.view");

        group.MapGet("/applications/export", async ([AsParameters] FacilityApplicationListParams p, IFacilityApplicationService svc, CancellationToken ct) =>
        {
            var (content, fileName) = await svc.ExportAsync(module, p, ct);
            return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }).RequirePermission("service-facilities.view");
    }

    private static void MapAttendance(RouteGroupBuilder group, string module)
    {
        group.MapGet("/attendance/roster", async (Guid sessionId, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetRosterAsync(module, sessionId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/attendance/save", async (SaveAttendanceRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SaveAsync(module, req, ct)))).RequireAnyPermission("service-facilities.view", "sessions.edit");

        group.MapPost("/attendance/correct", async (SaveAttendanceRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.CorrectAsync(module, req, ct)))).RequirePermission("facility-attendance.edit");

        group.MapGet("/attendance/registrations/{registrationId:guid}/history", async (Guid registrationId, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetHistoryByRegistrationAsync(module, registrationId, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/attendance/registrations/{registrationId:guid}/revise", async (Guid registrationId, ReviseAttendanceRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ReviseByRegistrationAsync(module, registrationId, req, ct)))).RequirePermission("facility-attendance.edit");

        group.MapPost("/attendance/check-in", async (CheckInRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.CheckInAsync(module, req.SessionId, req.Tckn, ct)))).RequireAnyPermission("service-facilities.view", "sessions.edit");

        group.MapPost("/attendance/manual", async (ManualCheckInRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.CheckInByFacilityAsync(module, req.FacilityId, req.Tckn, "manual", ct)))).RequireAnyPermission("service-facilities.view", "sessions.edit");

        group.MapPost("/attendance/qr", async (QrCheckInRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.CheckInByFacilityAsync(module, req.FacilityId, req.Code, "qr", ct)))).RequireAnyPermission("service-facilities.view", "qr-kiosk.scan");

        group.MapGet("/facilities/{facilityId:guid}/static-qr", async (Guid facilityId, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetStaticQrAsync(module, facilityId, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/facilities/{facilityId:guid}/static-qr/toggle", async (Guid facilityId, ToggleFacilityStaticQrRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStaticQrAsync(module, facilityId, req.Enabled, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/facilities/{facilityId:guid}/static-qr/mode", async (Guid facilityId, SetFacilityStaticQrModeRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrModeAsync(module, facilityId, req.Mode, ct)))).RequirePermission("service-facilities.edit");

        group.MapPatch("/facilities/{facilityId:guid}/static-qr/timing", async (Guid facilityId, SetFacilityStaticQrTimingRequest req, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrTimingAsync(module, facilityId, req.MinExitSeconds, req.ReentryCooldownSeconds, ct)))).RequirePermission("service-facilities.edit");

        group.MapPost("/facilities/{facilityId:guid}/static-qr/rotate", async (Guid facilityId, IFacilityAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RotateStaticQrAsync(module, facilityId, ct)))).RequirePermission("service-facilities.edit");
    }

    private static void MapDevices(RouteGroupBuilder group, string module)
    {
        // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P2-3, 2026-09-05
        // canlı testle doğrulandı): kimlik doğrulaması olmayan bu uç (cihaz X-Device-Key + kod
        // kabul ediyor) hiç rate limit'siz kalmıştı — 15 ardışık istek 0.3sn'de 15/15 200 döndü.
        // "device" politikası zaten LibraryDeviceEndpoints'te aynı amaçla kullanılıyor (IP başına
        // sabit pencere, varsayılan 120/60s) — kaba kuvvet/DoS yüzeyini kapatmak için eklendi.
        group.MapPost("/devices/checkin", async (DeviceCheckInRequest req, HttpContext http, IFacilityAttendanceService svc, CancellationToken ct) =>
        {
            var apiKey = http.Request.Headers["X-Device-Key"].ToString();
            return Results.Ok(ApiResponse.Ok(await svc.DeviceCheckInAsync(module, req.DeviceCode, apiKey, req.Code, ct)));
        }).AllowAnonymous().RequireRateLimiting("device");

        group.MapGet("/facilities/{facilityId:guid}/devices", async (Guid facilityId, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByFacilityAsync(module, facilityId, ct)))).RequirePermission("service-facilities.view");

        group.MapGet("/service-facilities/{serviceFacilityId:guid}/devices", async (Guid serviceFacilityId, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByServiceFacilityAsync(module, serviceFacilityId, ct)))).RequirePermission("service-facilities.view");

        group.MapGet("/devices/{id:guid}", async (Guid id, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(module, id, ct)))).RequirePermission("service-facilities.view");

        group.MapPost("/facilities/{facilityId:guid}/devices", async (Guid facilityId, CreateFacilityDeviceRequest req, IFacilityDeviceService svc, IValidator<CreateFacilityDeviceRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var scoped = req with { FacilityId = facilityId, Scope = string.IsNullOrWhiteSpace(req.Scope) ? "area" : req.Scope };
            var result = await svc.CreateAsync(module, scoped, ct);
            return Results.Created($"/api/v1/{module}/facilities/{facilityId}/devices/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.devices");

        group.MapPost("/devices", async (CreateFacilityDeviceRequest req, IFacilityDeviceService svc, IValidator<CreateFacilityDeviceRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/devices/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.devices");

        group.MapPut("/devices/{id:guid}", async (Guid id, UpdateFacilityDeviceRequest req, IFacilityDeviceService svc, IValidator<UpdateFacilityDeviceRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(module, id, req, ct)));
        }).RequirePermission("service-facilities.devices");

        group.MapDelete("/devices/{id:guid}", async (Guid id, IFacilityDeviceService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.devices");

        group.MapPatch("/devices/{id:guid}/toggle-status", async (Guid id, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(module, id, ct)))).RequirePermission("service-facilities.devices");

        group.MapPost("/devices/{id:guid}/rotate-key", async (Guid id, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RotateKeyAsync(module, id, ct)))).RequirePermission("service-facilities.devices");

        group.MapPost("/devices/{id:guid}/test-lock", async (Guid id, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.TestLockAsync(module, id, ct)))).RequirePermission("service-facilities.devices");

        group.MapPost("/devices/{id:guid}/open", async (Guid id, IFacilityDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ManualOpenAsync(module, id, ct)))).RequirePermission("service-facilities.manual-open");
    }

    private static void MapSettings(RouteGroupBuilder group, string module)
    {
        group.MapGet("/settings/general", async (IFacilitySettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetGeneralAsync(module, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPut("/settings/general", async (SaveGeneralSettingsRequest req, IFacilitySettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SaveGeneralAsync(module, req, ct)))).RequirePermission("service-facilities.edit");

        group.MapGet("/facilities/{facilityId:guid}/settings", async (Guid facilityId, IFacilitySettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetForFacilityAsync(module, facilityId, ct)))).RequirePermission("service-facilities.view");

        group.MapPut("/facilities/{facilityId:guid}/settings", async (Guid facilityId, SaveFacilitySettingsRequest req, IFacilitySettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SaveForFacilityAsync(module, facilityId, req, ct)))).RequirePermission("service-facilities.edit");
    }

    private static void MapReports(RouteGroupBuilder group, string module)
    {
        group.MapGet("/reports/summary", async (IFacilityReportService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetSummaryAsync(module, ct)))).RequirePermission("service-facilities.view");
    }

    private static void MapInstructors(RouteGroupBuilder group, string module)
    {
        group.MapGet("/instructors", async ([AsParameters] FacilityInstructorListParams p, IFacilityInstructorService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(module, p, ct)))).RequirePermission("service-facilities.view");

        group.MapGet("/instructors/options", async (IFacilityInstructorService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetOptionsAsync(module, ct)))).RequireAnyPermission("service-facilities.view", "sessions.view");

        group.MapPost("/instructors", async (CreateFacilityInstructorRequest req, IFacilityInstructorService svc, IValidator<CreateFacilityInstructorRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(module, req, ct);
            return Results.Created($"/api/v1/{module}/instructors/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("service-facilities.create");

        group.MapPut("/instructors/{id:guid}", async (Guid id, UpdateFacilityInstructorRequest req, IFacilityInstructorService svc, IValidator<UpdateFacilityInstructorRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(module, id, req, ct)));
        }).RequirePermission("service-facilities.edit");

        group.MapDelete("/instructors/{id:guid}", async (Guid id, IFacilityInstructorService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(module, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("service-facilities.delete");

        group.MapPatch("/instructors/{id:guid}/toggle-status", async (Guid id, IFacilityInstructorService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(module, id, ct)))).RequirePermission("service-facilities.edit");
    }
}
