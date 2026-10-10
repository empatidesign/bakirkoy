using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Education;
using Nexora.Application.Features.Education.Dtos;
using Nexora.Application.Features.Education.Requests;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Education;

public static class EducationEndpoints
{
    public static IEndpointRouteBuilder MapEducationEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/v1/education").WithTags("Education").RequireAuthorization("AdminOrAbove");
        var citizen = app.MapGroup("/api/v1/me/education").WithTags("Education").RequireAuthorization("Citizen");

        admin.MapGet("/institutions", async ([AsParameters] EducationInstitutionListParams p, IEducationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetInstitutionsAsync(p, ct)))).RequirePermission("participants.view");

        admin.MapGet("/institutions/options", async (IEducationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetInstitutionOptionsAsync(ct)))).RequirePermission("participants.view");

        admin.MapPost("/institutions", async (CreateEducationInstitutionRequest req, IValidator<CreateEducationInstitutionRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Created("", ApiResponse.Created(await svc.CreateInstitutionAsync(req, ct)));
        }).RequirePermission("participants.edit");

        admin.MapPut("/institutions/{id:guid}", async (Guid id, UpdateEducationInstitutionRequest req, IValidator<UpdateEducationInstitutionRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateInstitutionAsync(id, req, ct)));
        }).RequirePermission("participants.edit");

        admin.MapDelete("/institutions/{id:guid}", async (Guid id, IEducationService svc, CancellationToken ct) =>
        {
            await svc.DeleteInstitutionAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("participants.edit");

        admin.MapPatch("/institutions/{id:guid}/toggle-status", async (Guid id, IEducationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleInstitutionStatusAsync(id, ct)))).RequirePermission("participants.edit");

        admin.MapGet("/participants/{participantId:guid}/histories", async (Guid participantId, IEducationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetHistoriesAsync(participantId, ct)))).RequirePermission("participants.view");

        admin.MapPost("/participants/{participantId:guid}/histories", async (Guid participantId, CreateEducationHistoryRequest req, IValidator<CreateEducationHistoryRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Created("", ApiResponse.Created(await svc.CreateHistoryAsync(participantId, req, ct)));
        }).RequirePermission("participants.edit");

        admin.MapPut("/participants/{participantId:guid}/histories/{id:guid}", async (Guid participantId, Guid id, UpdateEducationHistoryRequest req, IValidator<UpdateEducationHistoryRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateHistoryAsync(participantId, id, req, ct)));
        }).RequirePermission("participants.edit");

        admin.MapDelete("/participants/{participantId:guid}/histories/{id:guid}", async (Guid participantId, Guid id, IEducationService svc, CancellationToken ct) =>
        {
            await svc.DeleteHistoryAsync(participantId, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("participants.edit");

        citizen.MapGet("/histories", async (Nexora.Application.Common.Interfaces.ICurrentUser currentUser, IEducationService svc, CancellationToken ct) =>
        {
            var pid = currentUser.Id ?? throw new Nexora.Application.Common.Exceptions.ForbiddenException("Giriş yapmalısınız.", "NOT_AUTHENTICATED");
            return Results.Ok(ApiResponse.Ok(await svc.GetHistoriesAsync(pid, ct)));
        });

        citizen.MapGet("/institutions/options", async (IEducationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetInstitutionOptionsAsync(ct))));

        citizen.MapPost("/histories", async (Nexora.Application.Common.Interfaces.ICurrentUser currentUser, CreateEducationHistoryRequest req, IValidator<CreateEducationHistoryRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var pid = currentUser.Id ?? throw new Nexora.Application.Common.Exceptions.ForbiddenException("Giriş yapmalısınız.", "NOT_AUTHENTICATED");
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Created("", ApiResponse.Created(await svc.CreateHistoryAsync(pid, req, ct)));
        });

        citizen.MapPut("/histories/{id:guid}", async (Nexora.Application.Common.Interfaces.ICurrentUser currentUser, Guid id, UpdateEducationHistoryRequest req, IValidator<UpdateEducationHistoryRequest> v, IEducationService svc, CancellationToken ct) =>
        {
            var pid = currentUser.Id ?? throw new Nexora.Application.Common.Exceptions.ForbiddenException("Giriş yapmalısınız.", "NOT_AUTHENTICATED");
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateHistoryAsync(pid, id, req, ct)));
        });

        citizen.MapDelete("/histories/{id:guid}", async (Nexora.Application.Common.Interfaces.ICurrentUser currentUser, Guid id, IEducationService svc, CancellationToken ct) =>
        {
            var pid = currentUser.Id ?? throw new Nexora.Application.Common.Exceptions.ForbiddenException("Giriş yapmalısınız.", "NOT_AUTHENTICATED");
            await svc.DeleteHistoryAsync(pid, id, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        return app;
    }
}
