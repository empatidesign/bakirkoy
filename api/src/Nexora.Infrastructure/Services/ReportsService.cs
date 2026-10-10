using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Reports;
using Nexora.Application.Features.Reports.Dtos;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services;

// UYE-RPT-001 (P0) canli denetiminde bulundu: Reports modulu hicbir scope/tesis filtrelemesi
// uygulamiyordu - sadece 1 kutuphaneye/tesise atanmis (scope kisitli) bir personel, reports.view
// izniyle TUM tesislerin/tum belediyenin verisini gorebiliyordu (IDOR). Artik LibraryManagementService
// ve digerleriyle ayni desen kullaniliyor: ICurrentUser + IUserScopeService inject edilip, her
// alt-modul icin GetScopedRefIdsAsync/GetScopedNamesAsync ile scope cozuluyor, null ise (scope yok =
// tam erisim) filtre uygulanmiyor, aksi halde ilgili DB sorgusuna WHERE olarak ekleniyor. UserScopeService
// su an sadece events/facility-submodulleri/travels/seda/library/muhtarlik icin scope cozebiliyor;
// quiz/survey/wheel/companies icin herhangi bir scope mekanizmasi yok, bu modullerde onceki (tam
// erisim) davranis korunuyor.
//
// KVKK duzeltmesi (2026-09-01, P0-2): GetOverviewAsync (topParticipants) ve
// GetParticipantDetailAsync ham TCKN/ad/telefon donduruyordu; IdentityMask/MaskEnabled hic
// kullanilmiyordu. /participants ucuyla ayni ParticipantSettings:MaskIdentity ayarina baglandik.
public class ReportsService(AppDbContext db, ICurrentUser currentUser, IUserScopeService userScope, IOptionsMonitor<ParticipantSettings> participantSettings) : IReportsService
{
    private bool MaskEnabled() => participantSettings.CurrentValue.MaskIdentity;

    private static readonly TimeZoneInfo TurkeyTz = SafeFindTz();

    private static TimeZoneInfo SafeFindTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"); }
        catch { return TimeZoneInfo.Utc; }
    }

    private static readonly (string Key, string Label)[] Modules =
    [
        ("events", "Etkinlik"),
        ("sports", "Spor Salonu"),
        ("kasif", "Kaşif Çocuk"),
        ("pool", "Havuz"),
        ("youth-camp", "Gençlik Kampı"),
        ("scout-camp", "İzcilik Kampı"),
        ("science-center", "Bilim Merkezi"),
        ("accessible-life", "Engelsiz Yaşam"),
        ("women-family", "Kadın ve Aile"),
        ("travels", "Gezi"),
        ("seda", "SEDA Eğitim"),
        ("library", "Kütüphane"),
        ("muhtarlik", "Muhtarlık"),
        ("quiz", "Bilgi Yarışması"),
        ("survey", "Anket"),
        ("wheel", "Hediye Çarkı"),
        ("companies", "Firma / Kampanya"),
    ];

    private static readonly string[] FacilitySubModules =
        ["sports", "kasif", "pool", "youth-camp", "scout-camp", "science-center", "accessible-life", "women-family"];

    private static readonly Dictionary<string, string> StatusLabels = new()
    {
        ["pending"] = "Beklemede",
        ["new"] = "Yeni",
        ["waitlist"] = "Yedek",
        ["reviewing"] = "İnceleniyor",
        ["approved"] = "Onaylı",
        ["active"] = "Aktif",
        ["confirmed"] = "Onaylı",
        ["resolved"] = "Çözüldü",
        ["completed"] = "Tamamlandı",
        ["forwarded"] = "Yönlendirildi",
        ["rejected"] = "Reddedildi",
        ["used"] = "Kullanıldı",
        ["cancelled"] = "İptal",
    };

    public async Task<ReportsOverviewDto> GetOverviewAsync(ReportsOverviewParams p, CancellationToken ct)
    {
        var (from, to, prevFrom, prevTo, presetKey) = ResolveRange(p.Preset, p.From, p.To);

        var (records, _) = await CollectAsync(prevFrom, to, p.Module, ct);
        var curr = records.Where(r => r.At >= from && r.At <= to).ToList();
        var prev = records.Where(r => r.At >= prevFrom && r.At <= prevTo).ToList();

        var kpis = BuildKpis(curr, prev);
        var modules = BuildModuleStats(curr, prev);
        var trend = BuildTrend(curr, from, to);
        var (topDemand, topRated) = await BuildTopItemsAsync(from, to, p.Module, ct);
        var topParticipants = BuildTopParticipants(curr);
        var gender = await BuildGenderAsync(curr, ct);
        var ages = await BuildAgesAsync(curr, ct);
        var nationality = BuildNationality(curr);
        var statusBreakdown = BuildStatusBreakdown(curr);
        var attendance = await BuildAttendanceAsync(from, to, p.Module, ct);
        var rating = await BuildRatingAsync(from, to, ct);

        return new ReportsOverviewDto(
            new ReportsRangeDto(presetKey, from, to, prevFrom, prevTo),
            kpis, modules, trend, topDemand, topRated, topParticipants,
            gender, ages, nationality, statusBreakdown, attendance, rating);
    }

    public async Task<ReportsParticipantDetailDto> GetParticipantDetailAsync(
        Guid? participantId, string? tckn, string? fullName, ReportsParticipantDetailParams p, CancellationToken ct)
    {
        var (from, to, _, _, _) = ResolveRange(p.Preset, p.From, p.To);
        var (records, isScopedCaller) = await CollectAsync(from, to, null, ct);

        var mine = records.Where(r =>
            (participantId.HasValue && r.ParticipantId == participantId) ||
            (!string.IsNullOrWhiteSpace(tckn) && !string.IsNullOrWhiteSpace(r.Tckn) && r.Tckn == tckn) ||
            (participantId is null && string.IsNullOrWhiteSpace(tckn) && !string.IsNullOrWhiteSpace(fullName) && r.FullName == fullName))
            .OrderByDescending(r => r.At)
            .ToList();

        // RPT-001 IDOR onlemi: scope'lu bir kullanici, kendi scope'u disindaki bir katilimciyi
        // TCKN/ID ile sorgulayip 0 sonuc alirsa (artik CollectAsync scope disini hic dondurmuyor),
        // bu durum "boş rapor" olarak degil 404 olarak donuyor - diger modullerdeki
        // EnsureInScopeAsync/NotFoundException deseniyle tutarli, katilimcinin var olup olmadigini
        // bile sizdirmiyor. Scope'suz (superadmin) kullanicilar icin davranis degismiyor.
        var hasIdentifier = participantId.HasValue || !string.IsNullOrWhiteSpace(tckn) || !string.IsNullOrWhiteSpace(fullName);
        if (mine.Count == 0 && isScopedCaller && hasIdentifier)
            throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var breakdown = mine.GroupBy(r => r.Module).ToDictionary(g => g.Key, g => g.Count());
        var resolvedName = mine.FirstOrDefault()?.FullName ?? fullName ?? "";
        var resolvedTckn = mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Tckn))?.Tckn ?? tckn;
        var resolvedPhone = mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Phone))?.Phone;

        var activities = mine.Select(r => new ReportsParticipantActivityDto(
            r.Module, ModuleLabel(r.Module), r.ItemName ?? "—", r.At, r.Status, StatusLabels.GetValueOrDefault(r.Status, r.Status))).ToList();

        var activitySummary = mine
            .GroupBy(r => (r.Module, ItemName: r.ItemName ?? "—"))
            .Select(g => new ReportsParticipantActivitySummaryDto(
                g.Key.Module, ModuleLabel(g.Key.Module), g.Key.ItemName, g.Count(),
                g.Max(x => x.At), g.Min(x => x.At)))
            .OrderByDescending(x => x.Count)
            .ThenByDescending(x => x.LastAt)
            .ToList();

        var mask = MaskEnabled();
        return new ReportsParticipantDetailDto(
            participantId,
            mask ? IdentityMask.MaskName(resolvedName) : resolvedName,
            mask && resolvedTckn is not null ? IdentityMask.MaskTckn(resolvedTckn) : resolvedTckn,
            mask && resolvedPhone is not null ? IdentityMask.MaskPhoneStrict(resolvedPhone) : resolvedPhone,
            mine.Count, breakdown, activities, activitySummary);
    }


    private sealed record Rec(
        string Module, DateTime At, string Status,
        Guid? ParticipantId, string? Tckn, string FullName, string? Phone,
        Gender? Gender, DateTime? BirthDate, string? ItemName);

    private async Task<(List<Rec> Records, bool IsScopedCaller)> CollectAsync(DateTime rangeFrom, DateTime rangeTo, string? moduleFilter, CancellationToken ct)
    {
        var list = new List<Rec>();
        bool Want(string m) => moduleFilter is null || moduleFilter == m;

        var uid = currentUser.Id;

        // Tek bir cagriyla hem "events" filtresi icin hem de genel "bu kullanici scope'lu mu"
        // bayragi icin kullanilir (UserScopeService.IsUnscopedAsync kullanici bazinda tekildir,
        // modul bagimsizdir: superadmin/scope'suz kullanici icin HER modulde null doner).
        var eventScopedIds = uid.HasValue ? await userScope.GetScopedRefIdsAsync(uid.Value, "events", ct) : null;
        var isScopedCaller = eventScopedIds is not null;

        if (Want("events"))
        {
            var eventsQuery =
                from a in db.EventApplications.AsNoTracking()
                where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join e in db.Events.AsNoTracking() on a.EventId equals e.Id into ej
                from e in ej.DefaultIfEmpty()
                join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                from pt in pj.DefaultIfEmpty()
                select new { a, e, pt };

            if (eventScopedIds is not null)
                eventsQuery = eventsQuery.Where(x => eventScopedIds.Contains(x.a.EventId));

            var events = await eventsQuery
                .Select(x => new Rec("events", x.a.CreatedAt, x.a.Status,
                    x.a.ParticipantId, x.pt != null ? x.pt.Tckn : null, x.pt != null ? x.pt.FullName : "—",
                    x.pt != null ? x.pt.Phone : null,
                    x.pt != null ? x.pt.Gender : (Gender?)null, x.pt != null ? x.pt.BirthDate : (DateTime?)null,
                    x.e != null ? x.e.Name : null)).ToListAsync(ct);
            list.AddRange(events);
        }

        foreach (var mod in FacilitySubModules)
        {
            if (!Want(mod)) continue;

            var facScopedIds = uid.HasValue ? await userScope.GetScopedRefIdsAsync(uid.Value, mod, ct) : null;
            if (facScopedIds is not null) isScopedCaller = true;

            var facQuery =
                from a in db.FacilityApplications.AsNoTracking()
                where a.Module == mod && a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join g in db.FacilityGroups.AsNoTracking() on a.GroupId equals g.Id into gj
                from g in gj.DefaultIfEmpty()
                join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                from pt in pj.DefaultIfEmpty()
                select new { a, g, pt };

            if (facScopedIds is not null)
                facQuery = facQuery.Where(x => facScopedIds.Contains(x.a.FacilityId));

            var facApps = await facQuery
                .Select(x => new Rec(mod, x.a.CreatedAt, x.a.Status,
                    x.a.ParticipantId, x.pt != null ? x.pt.Tckn : x.a.Tckn, x.pt != null ? x.pt.FullName : x.a.FullName,
                    x.pt != null ? x.pt.Phone : x.a.Phone,
                    x.pt != null ? x.pt.Gender : (Gender?)null, x.pt != null ? x.pt.BirthDate : x.a.BirthDate,
                    x.g != null ? x.g.Name : null)).ToListAsync(ct);
            list.AddRange(facApps);
        }

        if (Want("travels"))
        {
            var travelScopedIds = uid.HasValue ? await userScope.GetScopedRefIdsAsync(uid.Value, "travels", ct) : null;
            if (travelScopedIds is not null) isScopedCaller = true;

            var travelsQuery =
                from a in db.TravelApplications.AsNoTracking()
                where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join t in db.Travels.AsNoTracking() on a.TravelId equals t.Id into tj
                from t in tj.DefaultIfEmpty()
                join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                from pt in pj.DefaultIfEmpty()
                select new { a, t, pt };

            if (travelScopedIds is not null)
                travelsQuery = travelsQuery.Where(x => travelScopedIds.Contains(x.a.TravelId));

            var travels = await travelsQuery
                .Select(x => new Rec("travels", x.a.CreatedAt, x.a.Status,
                    x.a.ParticipantId, x.pt != null ? x.pt.Tckn : null, x.pt != null ? x.pt.FullName : (x.a.GuestFullName ?? "—"),
                    x.pt != null ? x.pt.Phone : x.a.GuestPhone,
                    x.pt != null ? x.pt.Gender : (Gender?)null, x.pt != null ? x.pt.BirthDate : x.a.GuestBirthDate,
                    x.t != null ? x.t.Name : null)).ToListAsync(ct);
            list.AddRange(travels);
        }

        if (Want("seda"))
        {
            var sedaScopedNames = uid.HasValue ? await userScope.GetScopedNamesAsync(uid.Value, "seda", ct) : null;
            if (sedaScopedNames is not null) isScopedCaller = true;

            var sedaQuery = db.SedaApplications.AsNoTracking()
                .Where(a => a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo);
            if (sedaScopedNames is not null)
                sedaQuery = sedaQuery.Where(a => sedaScopedNames.Contains(a.SchoolName));

            var seda = await sedaQuery
                .Select(a => new Rec("seda", a.CreatedAt, a.Status, null, a.Tckn,
                    a.StudentName + " " + a.StudentSurname, a.StudentPhone, null, a.BirthDate, a.SchoolName))
                .ToListAsync(ct);
            list.AddRange(seda);
        }

        if (Want("library"))
        {
            var libScopedIds = uid.HasValue ? await userScope.GetScopedRefIdsAsync(uid.Value, "library", ct) : null;
            if (libScopedIds is not null) isScopedCaller = true;

            var libAppQuery =
                from a in db.LibraryApplications.AsNoTracking()
                where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join l in db.Libraries.AsNoTracking() on a.LibraryId equals l.Id into lj
                from l in lj.DefaultIfEmpty()
                select new { a, l };
            if (libScopedIds is not null)
                libAppQuery = libAppQuery.Where(x => x.a.LibraryId.HasValue && libScopedIds.Contains(x.a.LibraryId.Value));

            var library = await libAppQuery
                .Select(x => new Rec("library", x.a.CreatedAt, x.a.Status, null, null,
                    x.a.ApplicantName + " " + x.a.ApplicantSurname, x.a.Phone, null, null,
                    x.l != null ? x.l.Name : null)).ToListAsync(ct);
            list.AddRange(library);

            var libSessionQuery =
                from s in db.LibrarySessions.AsNoTracking()
                where s.CreatedAt >= rangeFrom && s.CreatedAt <= rangeTo
                join l in db.Libraries.AsNoTracking() on s.LibraryId equals l.Id into lj
                from l in lj.DefaultIfEmpty()
                select new { s, l };
            if (libScopedIds is not null)
                libSessionQuery = libSessionQuery.Where(x => libScopedIds.Contains(x.s.LibraryId));

            var librarySessions = await libSessionQuery
                .Select(x => new Rec("library", x.s.CreatedAt, "completed",
                    x.s.ParticipantId, x.s.Tckn, x.s.MemberName, x.s.Phone, null, x.s.BirthDate,
                    x.l != null ? x.l.Name : null)).ToListAsync(ct);
            list.AddRange(librarySessions);
        }

        if (Want("muhtarlik"))
        {
            var muhtarlikScopedNames = uid.HasValue ? await userScope.GetScopedNamesAsync(uid.Value, "muhtarlik", ct) : null;
            if (muhtarlikScopedNames is not null) isScopedCaller = true;

            var muhtarlikQuery = db.CitizenSubmissions.AsNoTracking()
                .Where(a => a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo);
            if (muhtarlikScopedNames is not null)
                muhtarlikQuery = muhtarlikQuery.Where(a => muhtarlikScopedNames.Contains(a.Neighborhood));

            var muhtarlik = await muhtarlikQuery
                .Select(a => new Rec("muhtarlik", a.CreatedAt, a.Status, null, a.CitizenTc,
                    a.CitizenName, a.CitizenPhone, null, null, a.Title))
                .ToListAsync(ct);
            list.AddRange(muhtarlik);
        }

        // NOT: quiz/survey/wheel/companies modullerinde UserScopeService henuz herhangi bir scope
        // cozumlemesi desteklemiyor (bkz. UserScopeService.cs) - bu modullerde onceki (tam erisim)
        // davranis korunuyor, gorev talimatina uygun olarak "desteklenmeyen modul icin tum kaydi
        // dondurme" davranisi degistirilmedi.
        if (Want("quiz"))
        {
            var quiz = await (
                from q in db.QuizParticipations.AsNoTracking()
                where q.CreatedAt >= rangeFrom && q.CreatedAt <= rangeTo
                join qz in db.Quizzes.AsNoTracking() on q.QuizId equals qz.Id into qzj
                from qz in qzj.DefaultIfEmpty()
                select new Rec("quiz", q.CreatedAt, "completed", null, q.Tckn,
                    q.ParticipantName, null, null, null, qz != null ? qz.Title : null)).ToListAsync(ct);
            list.AddRange(quiz);
        }

        if (Want("survey"))
        {
            var survey = await (
                from r in db.SurveyResponses.AsNoTracking()
                where r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo
                join sv in db.Surveys.AsNoTracking() on r.SurveyId equals sv.Id into svj
                from sv in svj.DefaultIfEmpty()
                join pt in db.Participants.AsNoTracking() on r.ParticipantId equals pt.Id into pj
                from pt in pj.DefaultIfEmpty()
                select new Rec("survey", r.CreatedAt, "completed",
                    r.ParticipantId, r.CitizenTc, pt != null ? pt.FullName : "—", pt != null ? pt.Phone : null,
                    pt != null ? pt.Gender : (Gender?)null, pt != null ? pt.BirthDate : (DateTime?)null,
                    sv != null ? sv.Title : null)).ToListAsync(ct);
            list.AddRange(survey);
        }

        if (Want("wheel"))
        {
            var wheel = await db.GiftRequests.AsNoTracking()
                .Where(g => g.CreatedAt >= rangeFrom && g.CreatedAt <= rangeTo)
                .Select(g => new Rec("wheel", g.CreatedAt, g.Status.ToString().ToLower(),
                    g.ParticipantId, g.CitizenTc, g.CitizenName, g.CitizenPhone, null, null, g.GiftName))
                .ToListAsync(ct);
            list.AddRange(wheel);
        }

        if (Want("companies"))
        {
            var usage = await db.DiscountUsages.AsNoTracking()
                .Where(u => u.CreatedAt >= rangeFrom && u.CreatedAt <= rangeTo)
                .Select(u => new Rec("companies", u.CreatedAt, u.Status.ToString().ToLower(),
                    u.UserId, null, u.UserName, u.UserPhone, null, null, u.DiscountCode))
                .ToListAsync(ct);
            list.AddRange(usage);
        }

        return (list, isScopedCaller);
    }


    private static string ModuleLabel(string key) => Modules.FirstOrDefault(m => m.Key == key).Label ?? key;

    private static (DateTime From, DateTime To, DateTime PrevFrom, DateTime PrevTo, string PresetKey) ResolveRange(string? preset, DateTime? customFrom, DateTime? customTo)
    {
        var nowUtc = DateTime.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, TurkeyTz);
        var todayLocal = nowLocal.Date;

        DateTime LocalToUtc(DateTime local) => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), TurkeyTz);

        DateTime from, to;
        var key = (preset ?? "month").ToLowerInvariant();

        switch (key)
        {
            case "today":
                from = LocalToUtc(todayLocal);
                to = LocalToUtc(todayLocal.AddDays(1).AddTicks(-1));
                break;
            case "yesterday":
                from = LocalToUtc(todayLocal.AddDays(-1));
                to = LocalToUtc(todayLocal.AddTicks(-1));
                break;
            case "week":
                var weekStart = todayLocal.AddDays(-(int)((7 + (int)todayLocal.DayOfWeek - 1) % 7));
                from = LocalToUtc(weekStart);
                to = LocalToUtc(todayLocal.AddDays(1).AddTicks(-1));
                break;
            case "year":
                from = LocalToUtc(new DateTime(todayLocal.Year, 1, 1));
                to = LocalToUtc(todayLocal.AddDays(1).AddTicks(-1));
                break;
            case "custom":
                from = (customFrom ?? todayLocal.AddDays(-30)).Date;
                to = (customTo ?? todayLocal).Date.AddDays(1).AddTicks(-1);
                key = "custom";
                break;
            case "month":
            default:
                from = LocalToUtc(new DateTime(todayLocal.Year, todayLocal.Month, 1));
                to = LocalToUtc(todayLocal.AddDays(1).AddTicks(-1));
                key = "month";
                break;
        }

        var span = to - from;
        var prevTo = from.AddTicks(-1);
        var prevFrom = from - span - TimeSpan.FromTicks(1);

        return (from, to, prevFrom, prevTo, key);
    }

    private static List<ReportsKpiDto> BuildKpis(List<Rec> curr, List<Rec> prev)
    {
        int Count(List<Rec> src) => src.Count;
        int Approved(List<Rec> src) => src.Count(r => r.Status is "approved" or "active" or "confirmed" or "resolved" or "completed" or "used");
        int Pending(List<Rec> src) => src.Count(r => r.Status is "pending" or "new" or "waitlist" or "reviewing");
        int People(List<Rec> src) => src.Where(r => r.ParticipantId.HasValue || !string.IsNullOrWhiteSpace(r.Tckn))
            .Select(r => r.ParticipantId.HasValue ? r.ParticipantId.Value.ToString() : r.Tckn!)
            .Distinct().Count();
        int Modules(List<Rec> src) => src.Select(r => r.Module).Distinct().Count();

        return
        [
            Kpi("total", "Toplam Katılım/Başvuru", Count(curr), Count(prev)),
            Kpi("approved", "Onaylanan / Tamamlanan", Approved(curr), Approved(prev)),
            Kpi("pending", "Bekleyen", Pending(curr), Pending(prev)),
            Kpi("people", "Tekil Katılımcı", People(curr), People(prev)),
            Kpi("modules", "Aktif Modül Sayısı", Modules(curr), Modules(prev)),
        ];
    }

    private static ReportsKpiDto Kpi(string key, string label, int cur, int prev)
        => new(key, label, cur, prev, prev == 0 ? (cur > 0 ? 100 : 0) : Math.Round((cur - prev) * 100.0 / prev, 1));

    private static List<ReportsModuleStatDto> BuildModuleStats(List<Rec> curr, List<Rec> prev)
        => Modules.Select(m =>
        {
            var c = curr.Where(r => r.Module == m.Key).ToList();
            var pv = prev.Count(r => r.Module == m.Key);
            var uniquePeople = c.Where(r => r.ParticipantId.HasValue || !string.IsNullOrWhiteSpace(r.Tckn))
                .Select(r => r.ParticipantId.HasValue ? r.ParticipantId.Value.ToString() : r.Tckn!)
                .Distinct().Count();
            var total = c.Count;
            var delta = pv == 0 ? (total > 0 ? 100 : 0) : Math.Round((total - pv) * 100.0 / pv, 1);
            return new ReportsModuleStatDto(
                m.Key, m.Label, total,
                c.Count(r => r.Status is "approved" or "active" or "confirmed" or "resolved" or "completed" or "used"),
                c.Count(r => r.Status is "pending" or "new" or "reviewing"),
                c.Count(r => r.Status == "waitlist"),
                c.Count(r => r.Status is "rejected" or "cancelled"),
                uniquePeople, pv, delta);
        }).Where(m => m.TotalApplications > 0 || m.PreviousTotal > 0).OrderByDescending(m => m.TotalApplications).ToList();

    private static List<ReportsTrendPointDto> BuildTrend(List<Rec> curr, DateTime rangeFrom, DateTime rangeTo)
    {
        var span = rangeTo - rangeFrom;
        var groupBy = span.TotalDays > 100 ? "month" : span.TotalDays > 21 ? "week" : "day";

        DateTime Bucket(DateTime d) => groupBy switch
        {
            "month" => new DateTime(d.Year, d.Month, 1),
            "week" => d.Date.AddDays(-(int)((d.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)d.DayOfWeek) - 1)),
            _ => d.Date,
        };

        var byBucket = curr
            .GroupBy(r => Bucket(r.At))
            .ToDictionary(g => g.Key, g => g.GroupBy(x => x.Module).ToDictionary(x => x.Key, x => x.Count()));

        var points = new List<ReportsTrendPointDto>();
        var cursor = Bucket(rangeFrom);
        var end = Bucket(rangeTo);
        var guard = 0;
        while (cursor <= end && guard++ < 800)
        {
            var values = byBucket.TryGetValue(cursor, out var v) ? v : new Dictionary<string, int>();
            foreach (var (key, _) in Modules)
                values.TryAdd(key, 0);
            points.Add(new ReportsTrendPointDto(cursor.ToString("yyyy-MM-dd"), values, values.Values.Sum()));
            cursor = groupBy switch { "month" => cursor.AddMonths(1), "week" => cursor.AddDays(7), _ => cursor.AddDays(1) };
        }
        return points;
    }

    private async Task<(List<ReportsTopItemDto> Demand, List<ReportsTopItemDto> Rated)> BuildTopItemsAsync(DateTime rangeFrom, DateTime rangeTo, string? moduleFilter, CancellationToken ct)
    {
        var demand = new List<ReportsTopItemDto>();
        bool Want(string m) => moduleFilter is null || moduleFilter == m;

        if (Want("events"))
        {
            var eventCounts = await (
                from a in db.EventApplications.AsNoTracking()
                where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join e in db.Events.AsNoTracking() on a.EventId equals e.Id
                group new { a, e } by new { e.Id, e.Name, e.Capacity } into g
                select new { g.Key.Name, g.Key.Capacity, Applications = g.Count(), Approved = g.Count(x => x.a.Status == "approved") }).ToListAsync(ct);
            demand.AddRange(eventCounts.Select(x => new ReportsTopItemDto(
                "events", "Etkinlik", x.Name, null, x.Applications, x.Approved, x.Capacity,
                x.Capacity > 0 ? (int)Math.Round(Math.Min(x.Applications, x.Capacity) * 100.0 / x.Capacity) : 0, 0, 0)));
        }

        foreach (var mod in FacilitySubModules)
        {
            if (!Want(mod)) continue;
            var groupCounts = await (
                from a in db.FacilityApplications.AsNoTracking()
                where a.Module == mod && a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo && a.GroupId != null
                join g in db.FacilityGroups.AsNoTracking() on a.GroupId equals g.Id
                group new { a, g } by new { g.Id, g.Name, g.Capacity } into grp
                select new { grp.Key.Name, grp.Key.Capacity, Applications = grp.Count(), Approved = grp.Count(x => x.a.Status == "approved") }).ToListAsync(ct);
            demand.AddRange(groupCounts.Select(x => new ReportsTopItemDto(
                mod, ModuleLabel(mod), x.Name, null, x.Applications, x.Approved, x.Capacity,
                x.Capacity > 0 ? (int)Math.Round(Math.Min(x.Applications, x.Capacity) * 100.0 / x.Capacity) : 0, 0, 0)));
        }

        if (Want("travels"))
        {
            var travelCounts = await (
                from a in db.TravelApplications.AsNoTracking()
                where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                join t in db.Travels.AsNoTracking() on a.TravelId equals t.Id
                group new { a, t } by new { t.Id, t.Name, t.Capacity } into g
                select new { g.Key.Name, g.Key.Capacity, Applications = g.Count(), Approved = g.Count(x => x.a.Status == "approved") }).ToListAsync(ct);
            demand.AddRange(travelCounts.Select(x => new ReportsTopItemDto(
                "travels", "Gezi", x.Name, null, x.Applications, x.Approved, x.Capacity,
                x.Capacity > 0 ? (int)Math.Round(Math.Min(x.Applications, x.Capacity) * 100.0 / x.Capacity) : 0, 0, 0)));
        }

        var sortedDemand = demand.OrderByDescending(x => x.Applications).Take(10).ToList();

        var rated = new List<ReportsTopItemDto>();
        if (Want("events"))
        {
            var eventRatings = await (
                from r in db.EventReviews.AsNoTracking()
                where r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo
                join e in db.Events.AsNoTracking() on r.EventId equals e.Id
                group r by new { e.Id, e.Name } into g
                select new { g.Key.Name, Avg = g.Average(x => x.Rating), Count = g.Count() }).ToListAsync(ct);
            rated.AddRange(eventRatings.Select(x => new ReportsTopItemDto("events", "Etkinlik", x.Name, null, 0, 0, 0, 0, Math.Round(x.Avg, 2), x.Count)));
        }
        if (Want("travels"))
        {
            var travelRatings = await (
                from r in db.TravelReviews.AsNoTracking()
                where r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo
                join t in db.Travels.AsNoTracking() on r.TravelId equals t.Id
                group r by new { t.Id, t.Name } into g
                select new { g.Key.Name, Avg = g.Average(x => x.Rating), Count = g.Count() }).ToListAsync(ct);
            rated.AddRange(travelRatings.Select(x => new ReportsTopItemDto("travels", "Gezi", x.Name, null, 0, 0, 0, 0, Math.Round(x.Avg, 2), x.Count)));
        }

        var sortedRated = rated.Where(x => x.ReviewCount > 0).OrderByDescending(x => x.AvgRating).ThenByDescending(x => x.ReviewCount).Take(10).ToList();

        return (sortedDemand, sortedRated);
    }

    private List<ReportsTopParticipantDto> BuildTopParticipants(List<Rec> curr)
    {
        var mask = MaskEnabled();
        var withIdentity = curr.Where(r => r.ParticipantId.HasValue || !string.IsNullOrWhiteSpace(r.Tckn)).ToList();
        return withIdentity
            .GroupBy(r => !string.IsNullOrWhiteSpace(r.Tckn) ? ("t:" + r.Tckn) : ("p:" + r.ParticipantId))
            .Select(g => new
            {
                Key = g.Key,
                ParticipantId = g.FirstOrDefault(x => x.ParticipantId.HasValue)?.ParticipantId,
                FullName = g.OrderByDescending(x => x.At).First().FullName,
                Tckn = g.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Tckn))?.Tckn,
                Count = g.Count(),
                Breakdown = g.GroupBy(x => x.Module).ToDictionary(x => x.Key, x => x.Count()),
                Last = g.OrderByDescending(x => x.At).First(),
            })
            .OrderByDescending(x => x.Count)
            .Take(15)
            .Select(x => new ReportsTopParticipantDto(
                x.ParticipantId,
                mask ? IdentityMask.MaskName(x.FullName) : x.FullName,
                mask && x.Tckn is not null ? IdentityMask.MaskTckn(x.Tckn) : x.Tckn,
                x.Count, x.Breakdown, x.Last.At,
                x.Last.ItemName, ModuleLabel(x.Last.Module)))
            .ToList();
    }

    private async Task<ReportsGenderSliceDto> BuildGenderAsync(List<Rec> curr, CancellationToken ct)
    {
        var missingTckns = curr.Where(r => r.Gender is null && !r.ParticipantId.HasValue && !string.IsNullOrWhiteSpace(r.Tckn))
            .Select(r => r.Tckn!).Distinct().ToList();
        var byTckn = missingTckns.Count == 0
            ? new Dictionary<string, Gender>()
            : (await db.Participants.AsNoTracking().Where(p => missingTckns.Contains(p.Tckn)).Select(p => new { p.Tckn, p.Gender }).ToListAsync(ct))
                .ToDictionary(x => x.Tckn, x => x.Gender);

        Gender? Resolve(Rec r) => r.Gender ?? (!string.IsNullOrWhiteSpace(r.Tckn) && byTckn.TryGetValue(r.Tckn, out var g) ? g : (Gender?)null);

        var male = curr.Count(r => Resolve(r) == Gender.Male);
        var female = curr.Count(r => Resolve(r) == Gender.Female);
        var unknown = curr.Count - male - female;
        return new ReportsGenderSliceDto(male, female, unknown);
    }

    private async Task<List<ReportsAgeBucketDto>> BuildAgesAsync(List<Rec> curr, CancellationToken ct)
    {
        var missingTckns = curr.Where(r => r.BirthDate is null && !string.IsNullOrWhiteSpace(r.Tckn))
            .Select(r => r.Tckn!).Distinct().ToList();
        var byTckn = missingTckns.Count == 0
            ? new Dictionary<string, DateTime>()
            : (await db.Participants.AsNoTracking().Where(p => missingTckns.Contains(p.Tckn)).Select(p => new { p.Tckn, p.BirthDate }).ToListAsync(ct))
                .ToDictionary(x => x.Tckn, x => x.BirthDate);

        DateTime? Resolve(Rec r) => r.BirthDate ?? (!string.IsNullOrWhiteSpace(r.Tckn) && byTckn.TryGetValue(r.Tckn, out var b) ? b : (DateTime?)null);

        var now = DateTime.UtcNow;
        int Age(DateTime b) { var a = now.Year - b.Year; if (b.Date > now.AddYears(-a)) a--; return a; }
        string Bucket(int a) => a switch { <= 12 => "0-12", <= 17 => "13-17", <= 25 => "18-25", <= 40 => "26-40", <= 60 => "41-60", _ => "60+" };
        var order = new[] { "0-12", "13-17", "18-25", "26-40", "41-60", "60+" };

        // UYE-RPT-001 canlı testinde bulundu: doğum tarihi bulunamayan kayıtlar (örn. TCKN'siz/
        // participant'a bağlanamayan muhtarlık/wheel/quiz aktiviteleri) önceden SESSİZCE atlanıyordu
        // (Where(b => b.HasValue)) — bu, ageBuckets toplamının cinsiyet kırılımı toplamıyla (ki orası
        // unknown = total - male - female formülüyle HER ZAMAN %100'ü kapsıyor) TUTARSIZ olmasına
        // sebep oluyordu (canlı veride ~11.000 kayıtlık fark). Artık cinsiyet kırılımıyla AYNI desen
        // kullanılıyor: çözülemeyen yaş, "Bilinmiyor" adlı ayrı bir bucket'a ekleniyor, toplam korunuyor.
        var counts = curr.Select(Resolve).Where(b => b.HasValue)
            .GroupBy(b => Bucket(Age(b!.Value)))
            .ToDictionary(g => g.Key, g => g.Count());
        var known = counts.Values.Sum();
        var unknown = curr.Count - known;

        var result = order.Select(o => new ReportsAgeBucketDto(o, counts.GetValueOrDefault(o))).ToList();
        if (unknown > 0)
            result.Add(new ReportsAgeBucketDto("Bilinmiyor", unknown));
        return result;
    }

    private static ReportsNationalityDto BuildNationality(List<Rec> curr)
    {
        var withTckn = curr.Where(r => !string.IsNullOrWhiteSpace(r.Tckn)).ToList();
        return new ReportsNationalityDto(
            withTckn.Count(r => !r.Tckn!.StartsWith("99")),
            withTckn.Count(r => r.Tckn!.StartsWith("99")),
            curr.Count - withTckn.Count);
    }

    private static List<ReportsStatusBreakdownDto> BuildStatusBreakdown(List<Rec> curr)
        => curr.GroupBy(r => r.Status)
            .Select(g => new ReportsStatusBreakdownDto(g.Key, StatusLabels.GetValueOrDefault(g.Key, g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

    private async Task<List<ReportsAttendanceStatDto>> BuildAttendanceAsync(DateTime rangeFrom, DateTime rangeTo, string? moduleFilter, CancellationToken ct)
    {
        var result = new List<ReportsAttendanceStatDto>();
        bool Want(string m) => moduleFilter is null || moduleFilter == m;

        foreach (var mod in FacilitySubModules)
        {
            if (!Want(mod)) continue;
            var rows = await db.FacilityAttendances.AsNoTracking()
                .Where(a => a.Module == mod && a.MarkedAt >= rangeFrom && a.MarkedAt <= rangeTo)
                .Select(a => a.Status)
                .ToListAsync(ct);
            if (rows.Count == 0) continue;
            var present = rows.Count(s => s == "present");
            var absent = rows.Count(s => s == "absent");
            var late = rows.Count(s => s == "late");
            result.Add(new ReportsAttendanceStatDto(mod, ModuleLabel(mod), rows.Count, present, absent, late,
                rows.Count > 0 ? Math.Round((present + late) * 100.0 / rows.Count, 1) : 0));
        }

        if (Want("travels"))
        {
            var travelRows = await db.TravelAttendances.AsNoTracking()
                .Where(a => a.MarkedAt >= rangeFrom && a.MarkedAt <= rangeTo)
                .Select(a => a.Status)
                .ToListAsync(ct);
            if (travelRows.Count > 0)
            {
                var present = travelRows.Count(s => s == "present");
                var absent = travelRows.Count(s => s == "absent");
                var late = travelRows.Count(s => s == "late");
                result.Add(new ReportsAttendanceStatDto("travels", "Gezi", travelRows.Count, present, absent, late,
                    Math.Round((present + late) * 100.0 / travelRows.Count, 1)));
            }
        }

        if (Want("events"))
        {
            var eventRows = await db.EventActivities.AsNoTracking()
                .Where(a => a.Kind == "check_in" && a.At >= rangeFrom && a.At <= rangeTo)
                .Select(a => a.Status)
                .ToListAsync(ct);
            if (eventRows.Count > 0)
            {
                var present = eventRows.Count(s => s is "success" or "present" or "checked_in");
                result.Add(new ReportsAttendanceStatDto("events", "Etkinlik", eventRows.Count, present, eventRows.Count - present, 0,
                    Math.Round(present * 100.0 / eventRows.Count, 1)));
            }
        }

        return result.OrderByDescending(x => x.TotalSessions).ToList();
    }

    private async Task<ReportsRatingDto> BuildRatingAsync(DateTime rangeFrom, DateTime rangeTo, CancellationToken ct)
    {
        var ratings = await db.EventReviews.AsNoTracking()
            .Where(r => r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo)
            .Select(r => r.Rating)
            .Concat(db.TravelReviews.AsNoTracking()
                .Where(r => r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo)
                .Select(r => r.Rating))
            .ToListAsync(ct);

        var dist = new List<int> { 0, 0, 0, 0, 0 };
        foreach (var r in ratings)
            if (r is >= 1 and <= 5) dist[r - 1]++;
        var avg = ratings.Count > 0 ? Math.Round(ratings.Average(), 2) : 0;
        return new ReportsRatingDto(avg, dist, ratings.Count);
    }
}
