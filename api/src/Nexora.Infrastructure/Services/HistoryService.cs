using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.History;
using Nexora.Application.Features.History.Dtos;
using System.Text.Json;

namespace Nexora.Infrastructure.Services;

public class HistoryService(IUnitOfWork uow, ICurrentUser currentUser, IConfiguration config) : IHistoryService
{
    private static readonly TimeZoneInfo TurkeyTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    private int EventWindowDays => config.GetValue("ReviewSettings:EventWindowDays", 14);
    private int TravelWindowDays => config.GetValue("ReviewSettings:TravelWindowDays", 14);

    public async Task<PagedResult<HistoryItemDto>> GetHistoryAsync(HistoryListParams p, CancellationToken ct)
    {
        var pid = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var now = DateTime.UtcNow;
        var items = new List<HistoryItemDto>();

        if (string.IsNullOrEmpty(p.Type) || string.Equals(p.Type, "event", StringComparison.OrdinalIgnoreCase))
            await AppendEventHistoryAsync(items, pid, now, ct);

        if (string.IsNullOrEmpty(p.Type) || string.Equals(p.Type, "travel", StringComparison.OrdinalIgnoreCase))
            await AppendTravelHistoryAsync(items, pid, now, ct);

        if (string.IsNullOrEmpty(p.Type) || string.Equals(p.Type, "facility", StringComparison.OrdinalIgnoreCase))
            await AppendFacilityHistoryAsync(items, pid, now, ct);

        if (string.IsNullOrEmpty(p.Type) || string.Equals(p.Type, "survey", StringComparison.OrdinalIgnoreCase))
            await AppendSurveyHistoryAsync(items, pid, now, ct);

        var self = await uow.Participants.GetByIdAsync(pid, ct);
        if (self?.ReactivatedAt is DateTime reactivatedAt)
            items = items.Where(i => i.AppliedAt >= reactivatedAt).ToList();

        items = items.OrderByDescending(i => i.EndDate).ToList();

        var total = items.Count;
        var paged = items.Skip((p.PageResolved - 1) * p.LimitResolved).Take(p.LimitResolved).ToList();

        return new PagedResult<HistoryItemDto> { Items = paged, Total = total, Page = p.PageResolved, Limit = p.LimitResolved };
    }

    private async Task<List<Guid>> GetFamilyIdsAsync(Guid pid, CancellationToken ct)
    {
        var children = await uow.Participants.GetChildrenAsync(pid, ct);
        var ids = new List<Guid>(children.Select(c => c.Id)) { pid };
        return ids;
    }

    private async Task AppendEventHistoryAsync(List<HistoryItemDto> items, Guid pid, DateTime now, CancellationToken ct)
    {
        var familyIds = await GetFamilyIdsAsync(pid, ct);
        var apps = await uow.EventApplications.FindAsync(a => familyIds.Contains(a.ParticipantId) && a.Status == "approved", ct);
        if (apps.Count == 0) return;

        var appsBySelf = apps.Where(a => a.ParticipantId == pid).ToDictionary(a => a.Id);

        var sessionedApps = apps.Where(a => a.SessionId.HasValue).ToList();
        var directApps = apps.Where(a => !a.SessionId.HasValue).ToList();

        var allEventIds = new HashSet<Guid>(apps.Select(a => a.EventId));
        var allEventIdsList = allEventIds.ToList();
        var allEvents = (await uow.Events.FindAsync(e => allEventIdsList.Contains(e.Id), ct)).ToDictionary(e => e.Id);

        var catIds = allEvents.Values.Select(e => e.CategoryId).Distinct().ToList();
        var cats = (await uow.EventCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);

        var hallIds = allEvents.Values.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();
        var halls = hallIds.Count > 0
            ? (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id)
            : new Dictionary<Guid, Nexora.Domain.Entities.Halls.Hall>();

        var facilityIds = allEvents.Values.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();
        var facilities = facilityIds.Count > 0
            ? (await uow.ServiceFacilities.FindAsync(f => facilityIds.Contains(f.Id), ct)).ToDictionary(f => f.Id)
            : new Dictionary<Guid, Nexora.Domain.Entities.ServiceFacilities.ServiceFacility>();

        if (sessionedApps.Count > 0)
        {
            var sessionIds = sessionedApps.Select(a => a.SessionId!.Value).Distinct().ToList();
            var sessions = (await uow.Sessions.FindAsync(s => sessionIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

            var completedSessionedApps = sessionedApps.Where(a =>
            {
                if (!sessions.TryGetValue(a.SessionId!.Value, out var s)) return false;
                return s.Date.Date < now.Date;
            }).ToList();

            var completedEventIds = completedSessionedApps.Select(a => a.EventId).Distinct().ToList();
            var checkedInIds = await uow.EventActivities.GetCheckedInEventIdsAsync(pid, completedEventIds, ct);
            var reviewedIds = await uow.EventReviews.GetReviewedEventIdsAsync(pid, completedEventIds, ct);

            foreach (var app in completedSessionedApps)
            {
                var ev = allEvents.GetValueOrDefault(app.EventId);
                if (ev is null) continue;
                var session = sessions[app.SessionId!.Value];
                var cat = cats.GetValueOrDefault(ev.CategoryId);
                var checkedIn = checkedInIds.Contains(ev.Id);
                var alreadyReviewed = reviewedIds.Contains(ev.Id);
                var eventEnded = ev.EndDate < now;
                var withinWindow = eventEnded && (now - ev.EndDate).TotalDays <= EventWindowDays;

                var sessionStart = ParseSessionDateTime(session.Date, session.StartTime);
                var sessionEnd = ParseSessionDateTime(session.Date, session.EndTime);

                var hall = ev.HallId.HasValue && halls.TryGetValue(ev.HallId.Value, out var h) ? h : null;
                var hallName = hall?.Name;
                var facilityName = ev.FacilityId.HasValue && facilities.TryGetValue(ev.FacilityId.Value, out var fac) ? fac.Name : null;

                items.Add(new HistoryItemDto(
                    app.Id, "event", ev.Id, ev.Name,
                    cat?.Name ?? "", cat?.Color ?? "",
                    sessionStart, sessionEnd,
                    ExtractImageUrl(ev.ImagesJson),
                    app.Status, app.CreatedAt,
                    alreadyReviewed,
                    !alreadyReviewed && withinWindow && checkedIn,
                    checkedIn,
                    facilityName, hallName, HallSeatLabeler.Resolve(hall, app.SeatNumber),
                    ReservationType: ReadReservationType(ev.AccessJson)));
            }
        }

        if (directApps.Count > 0)
        {
            var directEventIds = directApps.Select(a => a.EventId).Distinct().ToList();
            var completedEvents = allEvents.Values
                .Where(e => directEventIds.Contains(e.Id) && e.EndDate < now)
                .ToDictionary(e => e.Id);

            if (completedEvents.Count > 0)
            {
                var completedIds = completedEvents.Keys.ToList();
                var checkedInIds = await uow.EventActivities.GetCheckedInEventIdsAsync(pid, completedIds, ct);
                var reviewedIds = await uow.EventReviews.GetReviewedEventIdsAsync(pid, completedIds, ct);

                foreach (var app in directApps.Where(a => completedEvents.ContainsKey(a.EventId)))
                {
                    var ev = completedEvents[app.EventId];
                    var cat = cats.GetValueOrDefault(ev.CategoryId);
                    var checkedIn = checkedInIds.Contains(ev.Id);
                    var alreadyReviewed = reviewedIds.Contains(ev.Id);
                    var withinWindow = (now - ev.EndDate).TotalDays <= EventWindowDays;

                    var hall = ev.HallId.HasValue && halls.TryGetValue(ev.HallId.Value, out var h) ? h : null;
                    var hallName = hall?.Name;
                    var facilityName = ev.FacilityId.HasValue && facilities.TryGetValue(ev.FacilityId.Value, out var fac) ? fac.Name : null;

                    // Kullanıcı bildirimi (2026-08-05): session'sız (direkt başvurulu) etkinliklerde
                    // ev.StartDate/EndDate sadece takvim gününü tutuyor (00:00) — gerçek saat
                    // ev.StartTime/EndTime string alanlarında ayrı duruyor ve önceden HİÇ
                    // birleştirilmiyordu, bu yüzden "Geçmişim" sayfasında bu etkinlikler için saat
                    // bilgisi ya hiç gelmiyordu ya da yanlış (gece yarısı) görünüyordu.
                    var startTs = CombineDateAndTime(ev.StartDate, ev.StartTime);
                    var endTs = CombineDateAndTime(ev.EndDate, ev.EndTime ?? ev.StartTime);

                    items.Add(new HistoryItemDto(
                        app.Id, "event", ev.Id, ev.Name,
                        cat?.Name ?? "", cat?.Color ?? "",
                        startTs, endTs,
                        ExtractImageUrl(ev.ImagesJson),
                        app.Status, app.CreatedAt,
                        alreadyReviewed,
                        !alreadyReviewed && withinWindow && checkedIn,
                        checkedIn,
                        facilityName, hallName, HallSeatLabeler.Resolve(hall, app.SeatNumber),
                        ReservationType: ReadReservationType(ev.AccessJson)));
                }
            }
        }
    }

    // Kullanıcı bildirimi (2026-08-05): "vatandaş portalında geçmişim sayfasında etkinliklerin
    // saatleri bilgileri yanlış veya gelmiyor" — kök neden: bu metod tarih+saati Türkiye yerel
    // saatinden UTC'ye HİÇ çevirmiyordu (DateTimeKind belirtilmeden AddHours/AddMinutes ile
    // birleştiriliyordu, .NET bunu "Unspecified" kind sayıyor). Sonradan API katmanındaki
    // TurkeyDateTimeConverter.Write bu "Unspecified" değeri YANLIŞLIKLA UTC sanıp üstüne tekrar
    // +3 saat Türkiye ofseti ekliyordu — sonuç saat bilgisi 3 saat kaymış olarak vatandaşa
    // gidiyordu (örn. gerçek 18:00 seansı 21:00 gibi görünüyordu). ParticipantEventService.
    // CombineDateAndTime ile aynı desen: yerel saat açıkça Unspecified işaretlenip
    // TimeZoneInfo.ConvertTimeToUtc ile GERÇEK UTC'ye çevriliyor, ardından converter'ın tekrar
    // Türkiye saatine çevirmesi doğru sonucu üretiyor.
    private static DateTime CombineDateAndTime(DateTime date, string? time)
    {
        if (!string.IsNullOrWhiteSpace(time) && TimeSpan.TryParse(time, out var parsed))
        {
            var local = DateTime.SpecifyKind(date.Date.Add(parsed), DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(local, TurkeyTz);
        }
        var localMidnight = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, TurkeyTz);
    }

    private static DateTime ParseSessionDateTime(DateTime date, string time) => CombineDateAndTime(date, time);

    private async Task AppendTravelHistoryAsync(List<HistoryItemDto> items, Guid pid, DateTime now, CancellationToken ct)
    {
        var familyIds = await GetFamilyIdsAsync(pid, ct);
        var apps = await uow.TravelApplications.FindAsync(a => familyIds.Contains(a.ParticipantId) && a.Status == "approved", ct);
        if (apps.Count == 0) return;

        var travelIds = apps.Select(a => a.TravelId).Distinct().ToList();
        var travels = await uow.Travels.FindAsync(t => travelIds.Contains(t.Id) && t.EndDate < now, ct);
        if (travels.Count == 0) return;

        var completedIds = travels.Select(t => t.Id).ToHashSet();
        var completedApps = apps.Where(a => completedIds.Contains(a.TravelId)).ToList();

        var catIds = travels.Select(t => t.CategoryId).Distinct().ToList();
        var cats = (await uow.TravelCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var travelDict = travels.ToDictionary(t => t.Id);

        var reviewedIds = await uow.TravelReviews.GetReviewedTravelIdsAsync(pid, completedIds.ToList(), ct);

        foreach (var app in completedApps)
        {
            var travel = travelDict[app.TravelId];
            var cat = cats.GetValueOrDefault(travel.CategoryId);
            var alreadyReviewed = reviewedIds.Contains(travel.Id);
            var withinWindow = (now - travel.EndDate).TotalDays <= TravelWindowDays;

            items.Add(new HistoryItemDto(
                app.Id, "travel", travel.Id, travel.Name,
                cat?.Name ?? "", cat?.Color ?? "",
                travel.StartDate, travel.EndDate,
                ExtractImageUrl(travel.ImagesJson),
                app.Status, app.CreatedAt,
                alreadyReviewed,
                !alreadyReviewed && withinWindow,
                true,
                null, null, app.SeatNumber, travel.Destination));
        }
    }

    private static string? ReadReservationType(string? accessJson)
    {
        if (string.IsNullOrWhiteSpace(accessJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(accessJson);
            if (doc.RootElement.TryGetProperty("reservationType", out var rt) && rt.ValueKind == JsonValueKind.String)
            {
                var val = rt.GetString();
                return string.IsNullOrWhiteSpace(val) ? null : val;
            }
        }
        catch { }
        return null;
    }

    private static string? ExtractImageUrl(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            if (doc.RootElement.TryGetProperty("ratios", out var ratiosEl) && ratiosEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var key in new[] { "16:9", "4:3", "1:1", "9:16" })
                {
                    if (ratiosEl.TryGetProperty(key, out var variantEl)
                        && variantEl.ValueKind == JsonValueKind.Object
                        && variantEl.TryGetProperty("url", out var urlEl)
                        && urlEl.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(urlEl.GetString()))
                        return urlEl.GetString();
                }
            }
            if (doc.RootElement.TryGetProperty("poster", out var poster) &&
                poster.ValueKind == JsonValueKind.String)
                return poster.GetString();
            foreach (var variant in new[] { "cover", "card", "thumb" })
            {
                if (doc.RootElement.TryGetProperty(variant, out var v) && v.ValueKind == JsonValueKind.String)
                    return v.GetString();
            }
        }
        catch { }
        return null;
    }

    private async Task AppendFacilityHistoryAsync(List<HistoryItemDto> items, Guid pid, DateTime now, CancellationToken ct)
    {
        var familyIds = await GetFamilyIdsAsync(pid, ct);
        var apps = await uow.FacilityApplications.FindAsync(a => familyIds.Contains(a.ParticipantId ?? Guid.Empty) && (a.Status == "approved" || a.Status == "completed"), ct);
        if (apps.Count == 0) return;

        var facilityIds = apps.Select(a => a.FacilityId).Distinct().ToList();
        var facilities = (await uow.ServiceFacilities.FindAsync(f => facilityIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);

        var groupIds = apps.Where(a => a.GroupId.HasValue).Select(a => a.GroupId!.Value).Distinct().ToList();
        var groups = groupIds.Count > 0
            ? (await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct)).ToDictionary(g => g.Id)
            : new Dictionary<Guid, Nexora.Domain.Entities.Facilities.FacilityGroup>();

        foreach (var app in apps)
        {
            var fac = facilities.GetValueOrDefault(app.FacilityId);
            var grp = app.GroupId.HasValue ? groups.GetValueOrDefault(app.GroupId.Value) : null;
            var title = grp?.Name ?? fac?.Name ?? "Tesis Programı";

            items.Add(new HistoryItemDto(
                ApplicationId: app.Id,
                Type: "facility",
                SourceId: app.GroupId ?? app.FacilityId,
                Title: title,
                CategoryName: app.Module,
                CategoryColor: "#0D9488",
                StartDate: app.AppliedAt,
                EndDate: app.AppliedAt.AddDays(30),
                ImageUrl: fac?.Images.FirstOrDefault()?.Url,
                Status: app.Status,
                AppliedAt: app.AppliedAt,
                HasReviewed: false,
                CanReview: false,
                CheckedIn: true,
                FacilityName: fac?.Name,
                Location: fac?.Address,
                ReservationType: "facility"
            ));
        }
    }

    private async Task AppendSurveyHistoryAsync(List<HistoryItemDto> items, Guid pid, DateTime now, CancellationToken ct)
    {
        var responses = await uow.Surveys.GetResponsesForParticipantAsync(pid, ct);
        if (responses.Count == 0) return;

        var surveyIds = responses.Select(r => r.SurveyId).Distinct().ToList();
        var surveys = (await uow.Surveys.FindAsync(s => surveyIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        foreach (var r in responses)
        {
            var survey = surveys.GetValueOrDefault(r.SurveyId);
            if (survey is null) continue;

            items.Add(new HistoryItemDto(
                ApplicationId: r.Id,
                Type: "survey",
                SourceId: survey.Id,
                Title: survey.Title,
                CategoryName: "Anket",
                CategoryColor: "#6366F1",
                StartDate: r.SubmittedAt,
                EndDate: r.SubmittedAt,
                ImageUrl: null,
                Status: "completed",
                AppliedAt: r.SubmittedAt,
                HasReviewed: false,
                CanReview: false,
                CheckedIn: true,
                ReservationType: "survey"
            ));
        }
    }
}
