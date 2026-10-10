using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Reports;
using Nexora.Application.Features.Reports.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Reports;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services;

// UYE-RPT-001 (P0): bkz. ReportsService.cs basindaki not - ayni IDOR aciginin bir diger yuzu
// burasi. ParticipantActivityRecord tablosu (ParticipantActivitySyncJob tarafindan periyodik
// senkronize edilen, tum modullerin denormalize edilmis kaydi) hicbir scope filtrelemesi
// olmadan sorgulaniyordu. Bu tablo modul basina bir refId kolonu tutmuyor (sadece Module +
// SourceTable + SourceId) - bu yuzden scope kontrolu, ilgili SourceTable'daki gercek kaynak
// satirina (EventApplications/FacilityApplications/TravelApplications/SedaApplications/
// LibraryApplications/LibrarySessions/CitizenSubmissions) join'lenerek cozulen "izin verilen
// SourceId" kumeleri ile, her modul icin ayri ayri uygulaniyor.
public class ParticipantActivityReportService(AppDbContext db, ICurrentUser currentUser, IUserScopeService userScope)
    : IParticipantActivityReportService
{
    private static readonly TimeZoneInfo TurkeyTz = SafeFindTz();
    private static TimeZoneInfo SafeFindTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"); }
        catch { return TimeZoneInfo.Utc; }
    }

    private static readonly string[] FacilitySubModules =
        ["sports", "kasif", "pool", "youth-camp", "scout-camp", "science-center", "accessible-life", "women-family"];

    private static readonly Dictionary<string, string> ModuleLabels = new()
    {
        ["events"] = "Etkinlik",
        ["sports"] = "Spor Salonu",
        ["kasif"] = "Kaşif Çocuk",
        ["pool"] = "Havuz",
        ["youth-camp"] = "Gençlik Kampı",
        ["scout-camp"] = "İzcilik Kampı",
        ["science-center"] = "Bilim Merkezi",
        ["women-family"] = "Kadın ve Aile",
        ["accessible-life"] = "Engelsiz Yaşam",
        ["travels"] = "Gezi",
        ["seda"] = "SEDA Eğitim",
        ["library"] = "Kütüphane",
        ["muhtarlik"] = "Muhtarlık",
        ["quiz"] = "Bilgi Yarışması",
        ["survey"] = "Anket",
        ["wheel"] = "Hediye Çarkı",
        ["companies"] = "Firma / Kampanya",
    };

    private sealed record ScopeRestriction(string Module, string SourceTable, HashSet<Guid> AllowedSourceIds);

    // Bu kullanici icin hangi (Module, SourceTable) ciftlerinin kisitlanmis oldugunu ve
    // her cift icin izin verilen SourceId kumesini cozer. Bos donen liste = kullanici hicbir
    // modulde scope'lu degil (superadmin veya scope atanmamis) -> tam erisim. quiz/survey/wheel/
    // companies icin UserScopeService herhangi bir scope cozumlemesi desteklemedigi icin bu
    // modullerde onceki (tam erisim) davranis korunuyor.
    private async Task<List<ScopeRestriction>> BuildScopeRestrictionsAsync(CancellationToken ct)
    {
        var restrictions = new List<ScopeRestriction>();
        if (currentUser.Id is not Guid uid) return restrictions;

        var eventScopedIds = await userScope.GetScopedRefIdsAsync(uid, "events", ct);
        if (eventScopedIds is not null)
        {
            var allowed = await db.EventApplications.AsNoTracking()
                .Where(a => eventScopedIds.Contains(a.EventId)).Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("events", "EventApplications", allowed.ToHashSet()));
        }

        foreach (var mod in FacilitySubModules)
        {
            var facScopedIds = await userScope.GetScopedRefIdsAsync(uid, mod, ct);
            if (facScopedIds is null) continue;
            var allowed = await db.FacilityApplications.AsNoTracking()
                .Where(a => a.Module == mod && facScopedIds.Contains(a.FacilityId)).Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction(mod, "FacilityApplications", allowed.ToHashSet()));
        }

        var travelScopedIds = await userScope.GetScopedRefIdsAsync(uid, "travels", ct);
        if (travelScopedIds is not null)
        {
            var allowed = await db.TravelApplications.AsNoTracking()
                .Where(a => travelScopedIds.Contains(a.TravelId)).Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("travels", "TravelApplications", allowed.ToHashSet()));
        }

        var sedaScopedNames = await userScope.GetScopedNamesAsync(uid, "seda", ct);
        if (sedaScopedNames is not null)
        {
            var allowed = await db.SedaApplications.AsNoTracking()
                .Where(a => sedaScopedNames.Contains(a.SchoolName)).Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("seda", "SedaApplications", allowed.ToHashSet()));
        }

        var libScopedIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (libScopedIds is not null)
        {
            var allowedApps = await db.LibraryApplications.AsNoTracking()
                .Where(a => a.LibraryId.HasValue && libScopedIds.Contains(a.LibraryId.Value))
                .Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("library", "LibraryApplications", allowedApps.ToHashSet()));

            var allowedSessions = await db.LibrarySessions.AsNoTracking()
                .Where(s => libScopedIds.Contains(s.LibraryId)).Select(s => s.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("library", "LibrarySessions", allowedSessions.ToHashSet()));
        }

        var muhtarlikScopedNames = await userScope.GetScopedNamesAsync(uid, "muhtarlik", ct);
        if (muhtarlikScopedNames is not null)
        {
            var allowed = await db.CitizenSubmissions.AsNoTracking()
                .Where(a => muhtarlikScopedNames.Contains(a.Neighborhood)).Select(a => a.Id).ToListAsync(ct);
            restrictions.Add(new ScopeRestriction("muhtarlik", "CitizenSubmissions", allowed.ToHashSet()));
        }

        return restrictions;
    }

    private static IQueryable<ParticipantActivityRecord> ApplyRestrictions(
        IQueryable<ParticipantActivityRecord> query, List<ScopeRestriction> restrictions)
    {
        foreach (var r in restrictions)
        {
            var allowed = r.AllowedSourceIds;
            var module = r.Module;
            var sourceTable = r.SourceTable;
            query = query.Where(x => !(x.Module == module && x.SourceTable == sourceTable) || allowed.Contains(x.SourceId));
        }
        return query;
    }

    public async Task<ParticipantActivityReportDto> GetReportAsync(ParticipantActivityReportParams p, CancellationToken ct)
    {
        var (from, to, presetKey) = ResolveRange(p.Preset, p.From, p.To);
        var page = Math.Max(1, p.Page ?? 1);
        var limit = Math.Clamp(p.Limit ?? 20, 1, 100);

        var baseQuery = db.ParticipantActivityRecords.AsNoTracking()
            .Where(x => x.ActivityDate >= from && x.ActivityDate <= to);
        var restrictions = await BuildScopeRestrictionsAsync(ct);
        baseQuery = ApplyRestrictions(baseQuery, restrictions);
        if (!string.IsNullOrWhiteSpace(p.Module)) baseQuery = baseQuery.Where(x => x.Module == p.Module);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search.Trim());
            baseQuery = baseQuery.Where(x => EF.Functions.ILike(x.FullName, $"%{s}%") || (x.Tckn != null && x.Tckn.Contains(s)));
        }

        var grouped = baseQuery.GroupBy(x => x.IdentityKey)
            .Select(g => new
            {
                IdentityKey = g.Key,
                Count = g.Count(),
                First = g.Min(x => x.ActivityDate),
                Last = g.Max(x => x.ActivityDate),
            });

        var total = await grouped.CountAsync(ct);

        var sortDesc = (p.Order ?? "desc").ToLowerInvariant() != "asc";
        IQueryable<dynamic> Sorted() => (p.Sort ?? "total").ToLowerInvariant() switch
        {
            "last" => sortDesc ? grouped.OrderByDescending(g => g.Last) : grouped.OrderBy(g => g.Last),
            "first" => sortDesc ? grouped.OrderByDescending(g => g.First) : grouped.OrderBy(g => g.First),
            _ => sortDesc ? grouped.OrderByDescending(g => g.Count) : grouped.OrderBy(g => g.Count),
        };

        var pageKeys = await Sorted().Skip((page - 1) * limit).Take(limit).ToListAsync(ct);
        var keySet = pageKeys.Select(x => (string)x.IdentityKey).ToHashSet();

        var rows = keySet.Count == 0
            ? []
            : await baseQuery.Where(x => keySet.Contains(x.IdentityKey))
                .Select(x => new { x.IdentityKey, x.ParticipantId, x.Tckn, x.FullName, x.Phone, x.Module, x.ItemName, x.ActivityDate })
                .ToListAsync(ct);

        var items = pageKeys.Select(k =>
        {
            var mine = rows.Where(r => r.IdentityKey == (string)k.IdentityKey).ToList();
            var last = mine.OrderByDescending(r => r.ActivityDate).First();
            var breakdown = mine.GroupBy(r => r.Module).ToDictionary(g => g.Key, g => g.Count());
            return new ParticipantActivityRowDto(
                mine.FirstOrDefault(r => r.ParticipantId.HasValue)?.ParticipantId,
                last.FullName,
                mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Tckn))?.Tckn,
                mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Phone))?.Phone,
                (int)k.Count, breakdown, (DateTime)k.First, (DateTime)k.Last, last.ItemName, last.Module);
        }).ToList();

        var totalPages = limit == 0 ? 1 : (int)Math.Ceiling(total / (double)limit);
        return new ParticipantActivityReportDto(presetKey, from, to, page, limit, total, Math.Max(1, totalPages), items);
    }

    public async Task<ParticipantActivityDetailDto?> GetDetailAsync(Guid? participantId, string? tckn, ParticipantActivityReportParams p, CancellationToken ct)
    {
        var (from, to, _) = ResolveRange(p.Preset, p.From, p.To);

        var query = db.ParticipantActivityRecords.AsNoTracking()
            .Where(x => x.ActivityDate >= from && x.ActivityDate <= to);
        var restrictions = await BuildScopeRestrictionsAsync(ct);
        query = ApplyRestrictions(query, restrictions);

        query = participantId.HasValue
            ? query.Where(x => x.ParticipantId == participantId)
            : !string.IsNullOrWhiteSpace(tckn)
                ? query.Where(x => x.Tckn == tckn)
                : query.Where(x => false);

        var mine = await query.OrderByDescending(x => x.ActivityDate).ToListAsync(ct);
        // Scope disindaki bir katilimci TCKN/ID ile sorgulandiginda artik 0 sonuc doner (yukaridaki
        // ApplyRestrictions sayesinde), bu da endpoint katmaninda (ReportsEndpoints.GetParticipantActivityDetail)
        // zaten 404 NOT_FOUND'a ceviriliyor - diger modullerdeki IDOR onlemleriyle tutarli, katilimcinin
        // var olup olmadigini bile sizdirmiyor.
        if (mine.Count == 0) return null;

        var breakdown = mine.GroupBy(r => r.Module).ToDictionary(g => g.Key, g => g.Count());
        var entries = mine.Select(r => new ParticipantActivityDetailEntryDto(
            r.Module, ModuleLabels.GetValueOrDefault(r.Module, r.Module), r.ItemName, r.ActivityDate, r.Status)).ToList();

        return new ParticipantActivityDetailDto(
            mine.FirstOrDefault(r => r.ParticipantId.HasValue)?.ParticipantId,
            mine.First().FullName,
            mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Tckn))?.Tckn,
            mine.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Phone))?.Phone,
            mine.Count, breakdown, entries);
    }

    private static (DateTime From, DateTime To, string PresetKey) ResolveRange(string? preset, DateTime? customFrom, DateTime? customTo)
    {
        var nowUtc = DateTime.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, TurkeyTz);
        var todayLocal = nowLocal.Date;
        DateTime LocalToUtc(DateTime local) => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), TurkeyTz);

        var key = (preset ?? "month").ToLowerInvariant();
        DateTime from, to;
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
        return (from, to, key);
    }
}
