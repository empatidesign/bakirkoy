using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Api.Endpoints.Participants;

public static class ParticipantServiceUsageEndpoints
{
    public static IEndpointRouteBuilder MapParticipantServiceUsageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/participants/{participantId:guid}/service-usage")
            .WithTags("ParticipantServiceUsage")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/{module}", GetOne).RequirePermission("participants.view");
        group.MapPut("/{module}", Set).RequirePermission("participants.edit");
        group.MapDelete("/{module}", Remove).RequirePermission("participants.edit");

        app.MapGet("/api/v1/participants-service-usage/{module}", GetMany)
            .WithTags("ParticipantServiceUsage")
            .RequireAuthorization("AdminOrAbove")
            .RequirePermission("participants.view");

        return app;
    }

    private static async Task<IResult> GetOne(
        Guid participantId,
        string module,
        IParticipantServiceUsageService service,
        CancellationToken ct)
    {
        var result = await service.GetAsync(module, participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetMany(
        string module,
        string? ids,
        IParticipantServiceUsageService service,
        CancellationToken ct)
    {
        var participantIds = (ids ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Guid.TryParse(x, out var g) ? g : (Guid?)null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var result = await service.GetManyAsync(module, participantIds, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Set(
        Guid participantId,
        string module,
        SetParticipantServiceUsageRequest req,
        IParticipantServiceUsageService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var result = await service.SetAsync(module, participantId, req, currentUser.Name, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Remove(
        Guid participantId,
        string module,
        IParticipantServiceUsageService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        await service.RemoveAsync(module, participantId, currentUser.Name, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
