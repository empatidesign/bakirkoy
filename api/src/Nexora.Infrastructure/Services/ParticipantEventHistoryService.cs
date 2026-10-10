using System.Text.Json;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Infrastructure.Services;

public class ParticipantEventHistoryService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IUserScopeService userScope) : IParticipantEventHistoryService
{
    public async Task<ParticipantEventResultDto> GetListAsync(ParticipantEventListParams p, CancellationToken ct)
    {
        var people = await ResolvePeopleAsync(p, ct);
        if (people.Count == 0)
            return Empty(p);

        var personIds = people.Keys.ToList();
        var applications = await uow.EventApplications.FindAsync(a => personIds.Contains(a.ParticipantId), ct);
        if (applications.Count == 0)
            return Empty(p);

        var eventIds = applications.Select(a => a.EventId).Distinct().ToList();
        var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var categories = await LoadCategoriesAsync(events.Values.Select(e => e.CategoryId), ct);
        var venues = await LoadVenueNamesAsync(events.Values.ToList(), ct);

        var checkedIn = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var personId in personIds)
            checkedIn[personId] = await uow.EventActivities.GetCheckedInEventIdsAsync(personId, eventIds, ct);

        var rows = new List<ParticipantEventDto>();
        foreach (var a in applications)
        {
            if (!events.TryGetValue(a.EventId, out var ev)) continue;

            var attendance = ResolveAttendance(a, ev, checkedIn[a.ParticipantId].Contains(a.EventId));

            rows.Add(new ParticipantEventDto(
                a.Id,
                a.ParticipantId,
                people[a.ParticipantId],
                ev.Name,
                a.ReferenceDate,
                FormatTime(ev),
                venues.GetValueOrDefault(ev.Id, "—"),
                categories.GetValueOrDefault(ev.CategoryId) ?? "—",
                attendance,
                MapApproval(a.Status)));
        }

        var counts = new ParticipantEventCountsDto(
            rows.Count,
            rows.Count(r => r.Attendance == "Attended"),
            rows.Count(r => r.Attendance == "Missed"),
            rows.Count(r => r.Attendance == "Excused"));

        var filtered = ApplyFilters(rows, p);
        var sorted = ApplySort(filtered, p);

        var total = sorted.Count;
        var page = p.PageResolved;
        var limit = p.LimitResolved;
        var items = sorted.Skip((page - 1) * limit).Take(limit).ToList();

        return new ParticipantEventResultDto
        {
            Items = items,
            Total = total,
            Page = page,
            Limit = limit,
            Counts = counts,
        };
    }

    private async Task<Dictionary<Guid, string>> ResolvePeopleAsync(ParticipantEventListParams p, CancellationToken ct)
    {
        if (p.PersonId is Guid personId)
        {
            await EnsureParticipantInScopeAsync(personId, ct);
            var person = await uow.Participants.GetByIdAsync(personId, ct)
                ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
            return new Dictionary<Guid, string> { [person.Id] = person.FullName };
        }

        if (p.ParticipantId is not Guid participantId)
            return [];

        await EnsureParticipantInScopeAsync(participantId, ct);
        var root = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var result = new Dictionary<Guid, string> { [root.Id] = root.FullName };
        foreach (var child in await uow.Participants.GetChildrenAsync(participantId, ct))
            result[child.Id] = child.FullName;

        return result;
    }

    private static List<ParticipantEventDto> ApplyFilters(List<ParticipantEventDto> rows, ParticipantEventListParams p)
    {
        IEnumerable<ParticipantEventDto> q = rows;

        if (!string.IsNullOrWhiteSpace(p.Attendance))
        {
            var attendance = p.Attendance.Trim();
            q = q.Where(r => string.Equals(r.Attendance, attendance, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = p.Search.Trim();
            q = q.Where(r =>
                r.EventName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                r.PersonName.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                r.Venue.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                r.Category.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        if (p.StartDate is DateTime start)
            q = q.Where(r => r.Date >= start.Date);

        if (p.EndDate is DateTime end)
            q = q.Where(r => r.Date < end.Date.AddDays(1));

        return q.ToList();
    }

    private static List<ParticipantEventDto> ApplySort(List<ParticipantEventDto> rows, ParticipantEventListParams p)
    {
        var descending = !string.Equals(p.Order, "asc", StringComparison.OrdinalIgnoreCase);

        return (p.Sort?.Trim().ToLowerInvariant()) switch
        {
            "eventname" => descending
                ? rows.OrderByDescending(r => r.EventName).ToList()
                : rows.OrderBy(r => r.EventName).ToList(),
            "attendance" => descending
                ? rows.OrderByDescending(r => r.Attendance).ThenByDescending(r => r.Date).ToList()
                : rows.OrderBy(r => r.Attendance).ThenByDescending(r => r.Date).ToList(),
            _ => descending
                ? rows.OrderByDescending(r => r.Date).ThenBy(r => r.EventName).ToList()
                : rows.OrderBy(r => r.Date).ThenBy(r => r.EventName).ToList(),
        };
    }

    private static string ResolveAttendance(EventApplication application, Event ev, bool hasCheckIn)
    {
        if (hasCheckIn) return "Attended";
        if (application.Status is "rejected" or "waitlist") return "Excused";

        var endsAt = ev.EndDate == default ? ev.StartDate : ev.EndDate;
        return endsAt.Date >= Nexora.Domain.Common.TurkeyTime.TodayDate().Date ? "Excused" : "Missed";
    }

    private static string MapApproval(string status) => status switch
    {
        "approved" => "Approved",
        "rejected" => "Rejected",
        _ => "Pending",
    };

    private static string? FormatTime(Event ev)
    {
        if (string.IsNullOrWhiteSpace(ev.StartTime)) return null;
        return string.IsNullOrWhiteSpace(ev.EndTime) ? ev.StartTime : $"{ev.StartTime} - {ev.EndTime}";
    }

    private async Task<Dictionary<Guid, string>> LoadCategoriesAsync(IEnumerable<Guid> categoryIds, CancellationToken ct)
    {
        var ids = categoryIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.EventCategories.FindAsync(c => ids.Contains(c.Id), ct))
            .ToDictionary(c => c.Id, c => c.Name);
    }

    private async Task<Dictionary<Guid, string>> LoadVenueNamesAsync(List<Event> events, CancellationToken ct)
    {
        var hallIds = events.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();
        var facIds = events.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();

        var halls = hallIds.Count == 0
            ? new Dictionary<Guid, Hall>()
            : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);

        var allFacIds = facIds.Concat(halls.Values.Select(h => h.FacilityId)).Distinct().ToList();
        var facs = allFacIds.Count == 0
            ? new Dictionary<Guid, ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(f => allFacIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);

        var result = new Dictionary<Guid, string>();
        foreach (var e in events)
        {
            var hall = e.HallId.HasValue ? halls.GetValueOrDefault(e.HallId.Value) : null;
            var fac = hall is not null
                ? facs.GetValueOrDefault(hall.FacilityId)
                : e.FacilityId.HasValue ? facs.GetValueOrDefault(e.FacilityId.Value) : null;

            result[e.Id] = hall?.Name ?? fac?.Name ?? ReadLocationName(e.LocationJson) ?? "—";
        }
        return result;
    }

    private static string? ReadLocationName(string? locationJson)
    {
        if (string.IsNullOrWhiteSpace(locationJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(locationJson);
            if (doc.RootElement.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String)
            {
                var name = n.GetString();
                return string.IsNullOrWhiteSpace(name) ? null : name;
            }
        }
        catch { return null; }
        return null;
    }

    private async Task EnsureParticipantInScopeAsync(Guid participantId, CancellationToken ct)
    {
        var scopedIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedParticipantIdsAsync(uid, ct)
            : null;

        if (scopedIds is not null && !scopedIds.Contains(participantId))
            throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
    }

    private static ParticipantEventResultDto Empty(ParticipantEventListParams p) => new()
    {
        Items = [],
        Total = 0,
        Page = p.PageResolved,
        Limit = p.LimitResolved,
        Counts = new ParticipantEventCountsDto(0, 0, 0, 0),
    };
}
