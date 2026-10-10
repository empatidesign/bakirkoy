using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Dtos;
using Nexora.Application.Features.Loyalty.Requests;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Loyalty;

public static class LoyaltyEndpoints
{
    public static IEndpointRouteBuilder MapLoyaltyEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/v1/loyalty").WithTags("Loyalty").RequireAuthorization("AdminOrAbove");
        var citizen = app.MapGroup("/api/v1/me/loyalty").WithTags("Loyalty").RequireAuthorization("Citizen");

        admin.MapGet("/rules", async ([AsParameters] LoyaltyRuleListParams p, ILoyaltyService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetRulesAsync(p, ct)))).RequirePermission("loyalty.view");

        admin.MapPost("/rules", async (CreateLoyaltyRuleRequest req, IValidator<CreateLoyaltyRuleRequest> validator, ILoyaltyService svc, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid)
                throw new AppValidationException(validation);

            return Results.Created("", ApiResponse.Created(await svc.CreateRuleAsync(req, ct)));
        }).RequirePermission("loyalty.create");

        admin.MapPut("/rules/{id:guid}", async (Guid id, UpdateLoyaltyRuleRequest req, IValidator<UpdateLoyaltyRuleRequest> validator, ILoyaltyService svc, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid)
                throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await svc.UpdateRuleAsync(id, req, ct)));
        }).RequirePermission("loyalty.edit");

        admin.MapDelete("/rules/{id:guid}", async (Guid id, ILoyaltyService svc, CancellationToken ct) =>
        {
            await svc.DeleteRuleAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("loyalty.delete");

        admin.MapGet("/transactions", async ([AsParameters] LoyaltyTransactionListParams p, ILoyaltyService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetTransactionsAsync(p, ct)))).RequirePermission("loyalty.view");

        admin.MapPost("/award", async (AdminGrantPointsRequest req, ILoyaltyService svc, CancellationToken ct) =>
        {
            var result = await svc.AdminGrantPointsAsync(req, ct);
            return Results.Ok(ApiResponse.Ok(result));
        }).RequirePermission("loyalty.create");

        admin.MapGet("/rewards", async ([AsParameters] RewardListParams p, ILoyaltyService svc, CancellationToken ct) =>
        {
            var result = await svc.GetRewardsPagedAsync(p, ct);
            return Results.Ok(ApiResponse.Ok(result));
        }).RequirePermission("loyalty.view");

        admin.MapPost("/rewards", async (CreateRewardRequest req, IValidator<CreateRewardRequest> validator, ILoyaltyService svc, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid)
                throw new AppValidationException(validation);

            return Results.Created("", ApiResponse.Created(await svc.CreateRewardAsync(req, ct)));
        }).RequirePermission("loyalty.create");

        admin.MapPost("/rewards/images", async (IFormFile file, ILoyaltyService svc, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            var url = await svc.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(new { url }));
        }).DisableAntiforgery().RequirePermission("loyalty.create");

        admin.MapPut("/rewards/{id:guid}", async (Guid id, UpdateRewardRequest req, IValidator<UpdateRewardRequest> validator, ILoyaltyService svc, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid)
                throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await svc.UpdateRewardAsync(id, req, ct)));
        }).RequirePermission("loyalty.edit");

        admin.MapDelete("/rewards/{id:guid}", async (Guid id, ILoyaltyService svc, CancellationToken ct) =>
        {
            await svc.DeleteRewardAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("loyalty.delete");

        admin.MapPatch("/rewards/{id:guid}/toggle-status", async (Guid id, ILoyaltyService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleRewardStatusAsync(id, ct)))).RequirePermission("loyalty.edit");

        admin.MapGet("/redemptions", async ([AsParameters] RedemptionListParams p, ILoyaltyService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetRedemptionsAsync(p, ct)))).RequirePermission("loyalty.view");

        admin.MapGet("/redemptions/pending-count", async (ILoyaltyService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPendingRedemptionCountAsync(ct)))).RequirePermission("loyalty.view");

        admin.MapPatch("/redemptions/{id:guid}/cancel", async (Guid id, CancelRedemptionRequest req, ILoyaltyService svc, CancellationToken ct) =>
        {
            await svc.CancelRedemptionAsync(id, req.Reason, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("loyalty.edit");

        citizen.MapPost("/check-in", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.DailyCheckInAsync(pid, ct)));
        });

        citizen.MapPost("/streak-modal/acknowledge", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            await svc.AcknowledgeStreakModalAsync(pid, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        citizen.MapGet("/streak", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.GetStreakAsync(pid, ct)));
        });

        citizen.MapPost("/welcome-bonus/consume", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.ConsumeWelcomeBonusAsync(pid, ct)));
        });

        citizen.MapGet("/earn-ways", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.GetEarnWaysAsync(pid, ct)));
        });

        citizen.MapGet("/balance", async (ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(new { balance = await svc.GetBalanceAsync(pid, ct) }));
        });

        citizen.MapGet("/transactions", async (ICurrentUser currentUser, [AsParameters] LoyaltyTransactionListParams p, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            var filtered = p with { ParticipantId = pid.ToString() };
            return Results.Ok(ApiResponse.Ok(await svc.GetTransactionsAsync(filtered, ct)));
        });

        citizen.MapGet("/rewards/catalog", async (ILoyaltyService svc, CancellationToken ct, int limit = 4)
            => Results.Ok(ApiResponse.Ok(await svc.GetRewardCatalogAsync(limit, ct))));

        citizen.MapPost("/rewards/redeem", async (ICurrentUser currentUser, RedeemRewardRequest req, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.RedeemRewardAsync(pid, req.RewardId, ct)));
        });

        citizen.MapGet("/redemptions", async (ICurrentUser currentUser, [AsParameters] RedemptionListParams p, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            var filtered = p with { ParticipantId = pid.ToString() };
            return Results.Ok(ApiResponse.Ok(await svc.GetRedemptionsAsync(filtered, ct)));
        });

        citizen.MapPost("/redemptions/{id:guid}/claim", async (Guid id, ICurrentUser currentUser, ILoyaltyService svc, CancellationToken ct) =>
        {
            var pid = RequireParticipant(currentUser);
            return Results.Ok(ApiResponse.Ok(await svc.ClaimRedemptionAsync(pid, id, ct)));
        });

        return app;
    }

    private static Guid RequireParticipant(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
