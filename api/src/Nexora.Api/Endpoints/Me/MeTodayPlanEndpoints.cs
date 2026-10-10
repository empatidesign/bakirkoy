using Nexora.Api.Common;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Api.Endpoints.Me;

public static class MeTodayPlanEndpoints
{
    public static IEndpointRouteBuilder MapMeTodayPlanEndpoints(this IEndpointRouteBuilder app)
    {
        var todayGroup = app.MapGroup("/api/v1/me/today-plans")
            .WithTags("MeTodayPlan")
            .RequireAuthorization("Citizen");
        todayGroup.MapGet("/", GetTodayPlans);

        var upcomingGroup = app.MapGroup("/api/v1/me/upcoming-facility-plans")
            .WithTags("MeTodayPlan")
            .RequireAuthorization("Citizen");
        upcomingGroup.MapGet("/", GetUpcomingFacilityPlans);

        return app;
    }

    private static async Task<IResult> GetTodayPlans(
        ICurrentUser currentUser,
        IUnitOfWork uow,
        IConfiguration config,
        CancellationToken ct)
    {
        var participantId = currentUser.Id;
        if (!participantId.HasValue)
            return Results.Ok(ApiResponse.Ok(Array.Empty<TodayPlanItemDto>()));

        var offset = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        var today = DateTime.UtcNow.AddMinutes(offset).Date;

        var children = await uow.Participants.GetChildrenAsync(participantId.Value, ct);
        var allIds = new List<Guid> { participantId.Value };
        allIds.AddRange(children.Select(c => c.Id));
        var selfName = (await uow.Participants.GetByIdAsync(participantId.Value, ct))?.FullName ?? "";
        var childNames = children.ToDictionary(c => c.Id, c => c.FullName);

        var result = new List<TodayPlanItemDto>();

        var sessions = await uow.Sessions.FindAsync(s => s.Date.Date == today && s.IsActive, ct);
        if (sessions.Count > 0)
        {
            var sessionIds = sessions.Select(s => s.Id).ToHashSet();
            var eventIds = sessions.Select(s => s.EventId).Distinct().ToList();
            var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct))
                .ToDictionary(e => e.Id);
            var sessionMap = sessions.ToDictionary(s => s.Id);
            var apps = await uow.EventApplications.FindAsync(
                a => a.SessionId.HasValue && sessionIds.Contains(a.SessionId.Value)
                     && allIds.Contains(a.ParticipantId) && a.Status == "approved", ct);

            var hallIds = events.Values.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToHashSet();
            var halls = hallIds.Count > 0
                ? (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id)
                : new Dictionary<Guid, Hall>();
            var evFacIds = events.Values
                .Select(e => e.HallId.HasValue && halls.TryGetValue(e.HallId.Value, out var h) ? (Guid?)h.FacilityId : e.FacilityId)
                .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToHashSet();
            var evServiceFacilities = evFacIds.Count > 0
                ? (await uow.ServiceFacilities.FindAsync(f => evFacIds.Contains(f.Id), ct)).ToDictionary(f => f.Id)
                : new Dictionary<Guid, ServiceFacility>();

            var grouped = apps.GroupBy(a => a.SessionId!.Value);
            foreach (var grp in grouped)
            {
                if (!sessionMap.TryGetValue(grp.Key, out var session)) continue;
                if (!events.TryGetValue(session.EventId, out var ev)) continue;
                var hall = ev.HallId.HasValue ? halls.GetValueOrDefault(ev.HallId.Value) : null;
                var evFacId = hall?.FacilityId ?? ev.FacilityId;
                var evFac = evFacId.HasValue ? evServiceFacilities.GetValueOrDefault(evFacId.Value) : null;
                string? venueName = hall?.Name ?? evFac?.Name;
                var persons = grp.Select(a => GetPersonName(a.ParticipantId, participantId.Value, selfName, childNames)).ToList();
                result.Add(new TodayPlanItemDto(
                    "event",
                    ev.Name,
                    $"{session.StartTime} – {session.EndTime}",
                    today,
                    persons,
                    venueName,
                    evFac?.Latitude,
                    evFac?.Longitude));
            }
        }

        var travels = await uow.Travels.FindAsync(
            t => t.IsActive && t.StartDate.Date <= today && t.EndDate.Date >= today, ct);
        if (travels.Count > 0)
        {
            var travelIds = travels.Select(t => t.Id).ToHashSet();
            var travelMap = travels.ToDictionary(t => t.Id);
            var apps = await uow.TravelApplications.FindAsync(
                a => travelIds.Contains(a.TravelId) && allIds.Contains(a.ParticipantId) && a.Status == "approved", ct);
            var grouped = apps.GroupBy(a => a.TravelId);
            foreach (var grp in grouped)
            {
                if (!travelMap.TryGetValue(grp.Key, out var travel)) continue;
                var persons = grp.Select(a => GetPersonName(a.ParticipantId, participantId.Value, selfName, childNames)).ToList();
                result.Add(new TodayPlanItemDto(
                    "travel",
                    travel.Name,
                    travel.Destination,
                    today,
                    persons,
                    null,
                    travel.Latitude,
                    travel.Longitude));
            }
        }

        var facSessions = await uow.FacilitySessions.FindAsync(s => s.Date.Date == today && !s.IsCancelled, ct);
        if (facSessions.Count > 0)
        {
            var groupIds = facSessions.Select(s => s.GroupId).Distinct().ToHashSet();
            var facSessionByGroup = facSessions.GroupBy(s => s.GroupId)
                .ToDictionary(g => g.Key, g => g.First());
            var groups = (await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct))
                .ToDictionary(g => g.Id);

            var facIds = groups.Values.Select(g => g.FacilityId).Distinct().ToHashSet();
            var modFacilities = (await uow.Facilities.FindAsync(f => facIds.Contains(f.Id), ct))
                .ToDictionary(f => f.Id);
            var sfIds = modFacilities.Values.Where(f => f.ServiceFacilityId.HasValue)
                .Select(f => f.ServiceFacilityId!.Value).Distinct().ToHashSet();
            var sfMap = sfIds.Count > 0
                ? (await uow.ServiceFacilities.FindAsync(f => sfIds.Contains(f.Id), ct)).ToDictionary(f => f.Id)
                : new Dictionary<Guid, ServiceFacility>();

            var regs = await uow.FacilityRegistrations.FindAsync(
                r => groupIds.Contains(r.GroupId) && r.ParticipantId.HasValue
                     && allIds.Contains(r.ParticipantId!.Value) && r.Status == "active" && r.Kind == "main", ct);

            var regsByGroup = regs.Where(r => r.ParticipantId.HasValue).GroupBy(r => r.GroupId)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var (gid, groupRegs) in regsByGroup)
            {
                if (!groups.TryGetValue(gid, out var group)) continue;
                if (!facSessionByGroup.TryGetValue(gid, out var fs)) continue;

                string? venueName = null;
                ServiceFacility? facSf = null;
                if (modFacilities.TryGetValue(group.FacilityId, out var mf))
                {
                    facSf = mf.ServiceFacilityId.HasValue ? sfMap.GetValueOrDefault(mf.ServiceFacilityId.Value) : null;
                    venueName = facSf?.Name ?? mf.Name;
                }

                var persons = groupRegs.Select(r => GetPersonName(r.ParticipantId!.Value, participantId.Value, selfName, childNames)).ToList();
                result.Add(new TodayPlanItemDto(
                    "facility",
                    group.Name,
                    $"{fs.StartTime} – {fs.EndTime}",
                    today,
                    persons,
                    venueName,
                    facSf?.Latitude,
                    facSf?.Longitude));
            }
        }

        result.Sort((a, b) => StringComparer.Ordinal.Compare(a.Time, b.Time));

        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetUpcomingFacilityPlans(
        ICurrentUser currentUser,
        IUnitOfWork uow,
        IConfiguration config,
        CancellationToken ct)
    {
        var participantId = currentUser.Id;
        if (!participantId.HasValue)
            return Results.Ok(ApiResponse.Ok(Array.Empty<UpcomingFacilityPlanDto>()));

        var offset = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        var today = DateTime.UtcNow.AddMinutes(offset).Date;

        var children = await uow.Participants.GetChildrenAsync(participantId.Value, ct);
        var allIds = new List<Guid> { participantId.Value };
        allIds.AddRange(children.Select(c => c.Id));
        var childNames = children.ToDictionary(c => c.Id, c => c.FullName);

        var regs = await uow.FacilityRegistrations.FindAsync(
            r => r.ParticipantId.HasValue && allIds.Contains(r.ParticipantId!.Value)
                 && r.Status == "active" && r.Kind == "main", ct);

        if (regs.Count == 0)
            return Results.Ok(ApiResponse.Ok(Array.Empty<UpcomingFacilityPlanDto>()));

        var groupIds = regs.Select(r => r.GroupId).Distinct().ToHashSet();
        var groups = (await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct))
            .ToDictionary(g => g.Id);

        var facilityIds = groups.Values.Select(g => g.FacilityId).Distinct().ToHashSet();
        var moduleFacilities = (await uow.Facilities.FindAsync(f => facilityIds.Contains(f.Id), ct))
            .ToDictionary(f => f.Id);

        var serviceFacilityIds = moduleFacilities.Values
            .Where(f => f.ServiceFacilityId.HasValue)
            .Select(f => f.ServiceFacilityId!.Value)
            .Distinct().ToHashSet();
        var serviceFacilities = (await uow.ServiceFacilities.FindAsync(f => serviceFacilityIds.Contains(f.Id), ct))
            .ToDictionary(f => f.Id);

        var sessions = (await uow.FacilitySessions.FindAsync(
            s => groupIds.Contains(s.GroupId) && s.Date.Date >= today && !s.IsCancelled, ct))
            .OrderBy(s => s.Date).ToList();

        var regsByGroup = regs
            .Where(r => r.ParticipantId.HasValue)
            .GroupBy(r => r.GroupId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<UpcomingFacilityPlanDto>();

        foreach (var session in sessions)
        {
            if (!groups.TryGetValue(session.GroupId, out var group)) continue;
            if (!regsByGroup.TryGetValue(session.GroupId, out var groupRegs)) continue;

            string? venueName = null;
            double? venueLat = null, venueLng = null;
            if (moduleFacilities.TryGetValue(group.FacilityId, out var modFac))
            {
                if (modFac.ServiceFacilityId.HasValue && serviceFacilities.TryGetValue(modFac.ServiceFacilityId.Value, out var sf))
                {
                    venueName = sf.Name;
                    venueLat = sf.Latitude;
                    venueLng = sf.Longitude;
                }
                else
                    venueName = modFac.Name;
            }

            var participants = groupRegs.Select(r =>
            {
                var pid = r.ParticipantId!.Value;
                var isSelf = pid == participantId.Value;
                var name = isSelf ? null : (childNames.TryGetValue(pid, out var n) ? n : null);
                return new UpcomingFacilityParticipantDto(name, isSelf);
            }).ToList();

            result.Add(new UpcomingFacilityPlanDto(
                group.Name,
                venueName,
                session.Date,
                $"{session.StartTime} – {session.EndTime}",
                participants,
                venueLat,
                venueLng));
        }

        return Results.Ok(ApiResponse.Ok(result));
    }

    private static string? GetPersonName(Guid pid, Guid selfId, string selfName, Dictionary<Guid, string> childNames)
    {
        if (pid == selfId) return null;
        return childNames.TryGetValue(pid, out var n) ? n : null;
    }
}

public record TodayPlanItemDto(
    string Type,
    string Title,
    string? Time,
    DateTime Date,
    List<string?> PersonNames,
    string? VenueName,
    double? Latitude = null,
    double? Longitude = null);

public record UpcomingFacilityPlanDto(
    string Title,
    string? VenueName,
    DateTime Date,
    string? TimeRange,
    List<UpcomingFacilityParticipantDto> Participants,
    double? Latitude = null,
    double? Longitude = null);

public record UpcomingFacilityParticipantDto(
    string? PersonName,
    bool IsSelf);
