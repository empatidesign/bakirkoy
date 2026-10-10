using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Application.Features.ServiceFacilities;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Api.Endpoints.Search;

public static class GlobalSearchEndpoints
{
    public static IEndpointRouteBuilder MapGlobalSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/search", Search)
            .WithTags("Search")
            .RequireAuthorization("AdminOrAbove");
        return app;
    }

    private static async Task<IResult> Search(
        string? q,
        int? limit,
        ICurrentUser current,
        IUnitOfWork uow,
        IServiceProvider sp,
        CancellationToken ct)
    {
        var query = (q ?? string.Empty).Trim();
        if (query.Length < 2)
            return Results.Ok(ApiResponse.Ok(GlobalSearchResult.Empty));

        var perModuleLimit = Math.Clamp(limit ?? 5, 1, 20);
        var limitStr = perModuleLimit.ToString();
        var userId = current.Id;
        var isSuperAdmin = current.IsSuperAdmin;

        async Task<bool> Can(params string[] keys)
        {
            if (isSuperAdmin) return true;
            if (userId is not Guid uid) return false;
            foreach (var key in keys)
                if (await uow.HasPermissionAsync(uid, key, ct)) return true;
            return false;
        }

        async Task Try(Func<Task> run)
        {
            try { await run(); }
            catch (OperationCanceledException) { throw; }
            catch { }
        }

        var facilities = new List<GlobalSearchFacilityHit>();
        var groups = new List<GlobalSearchGroupHit>();
        var applications = new List<GlobalSearchApplicationHit>();

        foreach (var module in FacilityModuleRegistry.All)
        {
            if (!await Can($"{module}.view", "service-facilities.view")) continue;

            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IFacilityService>().GetPagedAsync(module, new FacilityListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                facilities.AddRange(r.Items.Select(f => new GlobalSearchFacilityHit(f.Id, module, f.Name, f.District, f.IsActive)));
            });
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IFacilityGroupService>().GetPagedAsync(module, new FacilityGroupListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                groups.AddRange(r.Items.Select(g => new GlobalSearchGroupHit(g.Id, module, g.Name, g.FacilityId, g.FacilityName, g.IsActive)));
            });
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IFacilityApplicationService>().GetPagedAsync(module, new FacilityApplicationListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                applications.AddRange(r.Items.Select(a => new GlobalSearchApplicationHit(a.Id, module, a.FullName, a.Tckn, a.Phone, a.FacilityId, a.FacilityName, a.Status)));
            });
        }

        var participants = new List<GlobalSearchParticipantHit>();
        if (await Can("participants.view"))
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IParticipantService>().GetPagedAsync(new ParticipantListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                participants.AddRange(r.Items.Select(p => new GlobalSearchParticipantHit(p.Id, p.FullName, p.Tckn, p.Phone)));
            });

        var travels = new List<GlobalSearchNamedHit>();
        if (await Can("travels.view"))
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<ITravelService>().GetPagedAsync(new TravelListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                travels.AddRange(r.Items.Select(t => new GlobalSearchNamedHit(t.Id, t.Name, $"{t.Destination} · {t.StartDate:dd.MM.yyyy}")));
            });

        var events = new List<GlobalSearchNamedHit>();
        if (await Can("events.view"))
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IEventService>().GetPagedAsync(new EventListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                events.AddRange(r.Items.Select(e => new GlobalSearchNamedHit(e.Id, e.Name, $"{e.CategoryName} · {e.StartDate:dd.MM.yyyy}")));
            });

        var libraries = new List<GlobalSearchNamedHit>();
        if (await Can("library.view"))
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<ILibraryService>().GetPagedAsync(new LibraryListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                libraries.AddRange(r.Items.Select(l => new GlobalSearchNamedHit(l.Id, l.Name, l.District)));
            });

        var serviceFacilities = new List<GlobalSearchNamedHit>();
        if (await Can("service-facilities.view"))
            await Try(async () =>
            {
                var r = await sp.GetRequiredService<IServiceFacilityService>().GetPagedAsync(new ServiceFacilityListParams { Search = query, Page = "1", Limit = limitStr }, ct);
                serviceFacilities.AddRange(r.Items.Select(s => new GlobalSearchNamedHit(s.Id, s.Name, s.District)));
            });

        return Results.Ok(ApiResponse.Ok(new GlobalSearchResult(
            Facilities: facilities.Take(perModuleLimit * 3).ToList(),
            Groups: groups.Take(perModuleLimit * 3).ToList(),
            Applications: applications.Take(perModuleLimit * 3).ToList(),
            Participants: participants,
            Travels: travels,
            Events: events,
            Libraries: libraries,
            ServiceFacilities: serviceFacilities
        )));
    }
}

public record GlobalSearchFacilityHit(Guid Id, string Module, string Name, string? District, bool IsActive);
public record GlobalSearchGroupHit(Guid Id, string Module, string Name, Guid FacilityId, string? FacilityName, bool IsActive);
public record GlobalSearchApplicationHit(Guid Id, string Module, string FullName, string Tckn, string Phone, Guid FacilityId, string? FacilityName, string Status);
public record GlobalSearchParticipantHit(Guid Id, string FullName, string Tckn, string? Phone);
public record GlobalSearchNamedHit(Guid Id, string Name, string? Detail);

public record GlobalSearchResult(
    List<GlobalSearchFacilityHit> Facilities,
    List<GlobalSearchGroupHit> Groups,
    List<GlobalSearchApplicationHit> Applications,
    List<GlobalSearchParticipantHit> Participants,
    List<GlobalSearchNamedHit> Travels,
    List<GlobalSearchNamedHit> Events,
    List<GlobalSearchNamedHit> Libraries,
    List<GlobalSearchNamedHit> ServiceFacilities)
{
    public static GlobalSearchResult Empty => new([], [], [], [], [], [], [], []);
}
