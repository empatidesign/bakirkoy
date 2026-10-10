using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Analytics;
using Nexora.Application.Features.Analytics.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services;

public class AnalyticsService(AppDbContext db, ICurrentUser currentUser, IUnitOfWork uow, IUserScopeService userScope, IOnlineUserTracker onlineTracker) : IAnalyticsService
{
    private static readonly (string Key, string Label)[] Modules =
    [
        ("events", "Etkinlik"),
        ("facilities", "Tesis Programları"),
        ("travels", "Gezi"),
        ("seda", "SEDA Eğitim"),
        ("library", "Kütüphane"),
        ("muhtarlik", "Muhtarlık"),
    ];

    private static readonly string[] FacilityPermissionModules =
        ["sports", "pool", "youth-camp", "scout-camp", "science-center", "kasif", "accessible-life", "women-family"];

    public async Task<AnalyticsOverviewDto> GetOverviewAsync(AnalyticsOverviewParams p, CancellationToken ct)
    {
        // Denetim düzeltmesi (2026-08-31): from/to admin panelden Türkiye takvim günü olarak
        // gelir (örn. "2026-09-01"), ama önceki kod bunu doğrudan DateTime.UtcNow.Date /
        // p.To.Date ile UTC gün sınırı sanıyordu. Sonuç: "bugün" seçildiğinde Türkiye saatiyle
        // 00:00-03:00 arası kayıtlar dışarıda kalıyor, 21:00-24:00 arası kayıtlar "yarına"
        // sızıyordu (kanıt: canlı testte DB'de "bugün Türkiye saatiyle" 0 muhtarlık kaydı
        // varken API 1 döndürdü — bir önceki günün 21:53 TR / 18:53 UTC kaydı yanlış sayıldı).
        // ReportsService.ResolveRange'deki (2026-08-26'da düzeltilmiş) aynı desen uygulanıyor:
        // Türkiye yerel gün sınırları hesaplanıp gerçek UTC'ye çevriliyor.
        var toLocalDate = (p.To ?? TurkeyTime.TodayDate()).Date;
        var fromLocalDate = (p.From ?? toLocalDate.AddDays(-30)).Date;
        var to = TurkeyTime.ToUtc(toLocalDate.AddDays(1)).AddTicks(-1);
        var from = TurkeyTime.ToUtc(fromLocalDate);
        var groupBy = Normalize(p.GroupBy);
        var span = to - from;
        var prevTo = from.AddTicks(-1);
        var prevFrom = from - span;

        var scope = await ResolveScopeAsync(ct);

        var records = await CollectAsync(prevFrom, to, scope, ct);
        var curr = records.Where(r => r.CreatedAt >= from && r.CreatedAt <= to).ToList();
        var prev = records.Where(r => r.CreatedAt >= prevFrom && r.CreatedAt <= prevTo).ToList();

        var kpis = BuildKpis(curr, prev);
        var trend = BuildTrend(curr, from, to, groupBy, scope.AllowedModules);
        var modules = BuildModules(curr, prev, scope.AllowedModules);
        var gender = BuildGender(curr);
        var ages = BuildAges(curr);
        var nationality = BuildNationality(curr);
        var rating = await BuildRatingAsync(from, to, scope, ct);
        var (topDemand, topRated) = await BuildTopProgramsAsync(from, to, scope, ct);

        return new AnalyticsOverviewDto(
            new AnalyticsRangeDto(from, to, groupBy),
            kpis, trend, modules, gender, ages, nationality, rating, topDemand, topRated);
    }

    /// <summary>
    /// Denetim düzeltmesi (2026-08-31, KRİTİK-KVKK): bu sınıf önceden yalnızca MODÜL anahtarı
    /// bazında (örn. "library.view" var mı) izin kontrolü yapıyordu, ScopedStaffService/
    /// AdminScopes ile atanan ÖRNEK bazlı (tek bir kütüphane/tesis/gezi/etkinlik) kısıtlamayı
    /// hiç uygulamıyordu. Aynı desen ReportsService.CollectAsync'de (2026-08-26 P0 UYE-RPT-001
    /// düzeltmesi) zaten mevcuttu, ama bu dashboard/analytics servisine hiç taşınmamıştı.
    /// Canlı kanıt: tek bir kütüphaneye ("50.Yıl Kitap Kafe") scope'lu bir Kıraathane
    /// Sorumlusu, dashboard-activity'de TAMAMEN FARKLI 3 kütüphanenin başvurularını
    /// (ad-soyad dahil) ve genel toplamdaki 27 kütüphanenin tamamının istatistiğini
    /// görebiliyordu. Ayrıca "facilities" tek bir modül anahtarı altında toplandığı için
    /// yalnızca "kasif.*" iznine sahip (sports/pool/vb. hiçbirine erişimi olmayan) bir
    /// Kaşif Çocuk Yöneticisi, TÜM tesis alt-modüllerinin (spor/havuz/bilim merkezi/...)
    /// toplam sayılarını görebiliyordu (canlı kanıt: kasif-only rolün "facilities" toplamı
    /// superadmin'in gördüğü toplamla birebir aynıydı — 30.865 kayıt, oysa kasif'in kendi
    /// payı yalnızca ~7.371).
    /// </summary>
    private sealed record AnalyticsScope(
        HashSet<string>? AllowedModules,
        HashSet<Guid>? EventIds,
        Dictionary<string, HashSet<Guid>?> FacilityIdsByModule,
        HashSet<Guid>? TravelIds,
        HashSet<string>? SedaSchoolNames,
        HashSet<Guid>? LibraryIds,
        HashSet<string>? MuhtarlikNeighborhoods)
    {
        public bool IsUnscoped => AllowedModules is null;
    }

    private async Task<AnalyticsScope> ResolveScopeAsync(CancellationToken ct)
    {
        var allowedModules = await ResolveAllowedModulesAsync(ct);
        if (currentUser.Id is not Guid userId)
            return new AnalyticsScope(allowedModules, null, new(), null, null, null, null);

        HashSet<Guid>? eventIds = null;
        if (allowedModules is null || allowedModules.Contains("events"))
        {
            var ids = await userScope.GetScopedRefIdsAsync(userId, "events", ct);
            if (ids is not null) eventIds = ids;
        }

        var facilityIdsByModule = new Dictionary<string, HashSet<Guid>?>();
        if (allowedModules is null || allowedModules.Contains("facilities"))
        {
            foreach (var mod in FacilityPermissionModules)
            {
                var ids = await userScope.GetScopedRefIdsAsync(userId, mod, ct);
                facilityIdsByModule[mod] = ids;
            }
        }

        HashSet<Guid>? travelIds = null;
        if (allowedModules is null || allowedModules.Contains("travels"))
        {
            var ids = await userScope.GetScopedRefIdsAsync(userId, "travels", ct);
            if (ids is not null) travelIds = ids;
        }

        HashSet<string>? sedaSchoolNames = null;
        if (allowedModules is null || allowedModules.Contains("seda"))
        {
            var names = await userScope.GetScopedNamesAsync(userId, "seda", ct);
            if (names is not null) sedaSchoolNames = names;
        }

        HashSet<Guid>? libraryIds = null;
        if (allowedModules is null || allowedModules.Contains("library"))
        {
            var ids = await userScope.GetScopedRefIdsAsync(userId, "library", ct);
            if (ids is not null) libraryIds = ids;
        }

        HashSet<string>? muhtarlikNeighborhoods = null;
        if (allowedModules is null || allowedModules.Contains("muhtarlik"))
        {
            var names = await userScope.GetScopedNamesAsync(userId, "muhtarlik", ct);
            if (names is not null) muhtarlikNeighborhoods = names;
        }

        return new AnalyticsScope(allowedModules, eventIds, facilityIdsByModule, travelIds, sedaSchoolNames, libraryIds, muhtarlikNeighborhoods);
    }

    private async Task<HashSet<string>?> ResolveAllowedModulesAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin) return null;
        if (currentUser.Id is not Guid userId) return [];

        var user = await uow.AdminUsers.GetByIdAsync(userId, ct);
        if (user is null) return [];

        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(user.RoleId, ct);
        if (permissionIds.Count == 0) return [];

        var permissions = await uow.Permissions.GetByIdsAsync(permissionIds, ct);
        var moduleKeys = permissions.Select(perm => perm.ModuleKey).ToHashSet();

        var allowed = new HashSet<string>();
        foreach (var (key, _) in Modules)
        {
            if (key == "facilities")
            {
                if (FacilityPermissionModules.Any(moduleKeys.Contains)) allowed.Add(key);
                continue;
            }
            if (moduleKeys.Contains(key)) allowed.Add(key);
        }
        return allowed;
    }

    private sealed record Rec(string Module, DateTime CreatedAt, string Status, Gender? Gender, DateTime? BirthDate, string? Tckn);

    private async Task<List<Rec>> CollectAsync(DateTime rangeFrom, DateTime rangeTo, AnalyticsScope scope, CancellationToken ct)
    {
        bool Allowed(string module) => scope.IsUnscoped || scope.AllowedModules!.Contains(module);
        var list = new List<Rec>();

        if (Allowed("events"))
        {
            var query = from a in db.EventApplications.AsNoTracking()
                        where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                        join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                        from pt in pj.DefaultIfEmpty()
                        select new { a, pt };
            if (scope.EventIds is not null)
                query = query.Where(x => scope.EventIds.Contains(x.a.EventId));

            var events = await query
                .Select(x => new Rec("events", x.a.CreatedAt, x.a.Status,
                    x.pt != null ? x.pt.Gender : (Gender?)null,
                    x.pt != null ? x.pt.BirthDate : (DateTime?)null,
                    x.pt != null ? x.pt.Tckn : null)).ToListAsync(ct);
            list.AddRange(events);
        }

        if (Allowed("facilities"))
        {
            // Alt-modül bazlı örnek scope: her tesis alt-modülü (spor/havuz/kasif/...) kendi
            // ScopeNode anahtarına sahiptir. ApplyFacilityScope() join'den ÖNCE uygulanıyor —
            // aksi halde EF Core Dictionary tabanlı ifadeyi SQL'e çeviremiyor (bkz. metod yorumu).
            var query = from a in ApplyFacilityScope(db.FacilityApplications.AsNoTracking(), scope)
                        where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                        join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                        from pt in pj.DefaultIfEmpty()
                        select new { a, pt };

            var facilities = await query
                .Select(x => new Rec("facilities", x.a.CreatedAt, x.a.Status,
                    x.pt != null ? x.pt.Gender : (Gender?)null,
                    x.pt != null ? x.pt.BirthDate : x.a.BirthDate,
                    x.pt != null ? x.pt.Tckn : x.a.Tckn)).ToListAsync(ct);
            list.AddRange(facilities);
        }

        if (Allowed("travels"))
        {
            var query = from a in db.TravelApplications.AsNoTracking()
                        where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
                        join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                        from pt in pj.DefaultIfEmpty()
                        select new { a, pt };
            if (scope.TravelIds is not null)
                query = query.Where(x => scope.TravelIds.Contains(x.a.TravelId));

            var travels = await query
                .Select(x => new Rec("travels", x.a.CreatedAt, x.a.Status,
                    x.pt != null ? x.pt.Gender : (Gender?)null,
                    x.pt != null ? x.pt.BirthDate : (DateTime?)null,
                    x.pt != null ? x.pt.Tckn : null)).ToListAsync(ct);
            list.AddRange(travels);
        }

        if (Allowed("seda"))
        {
            var query = db.SedaApplications.AsNoTracking()
                .Where(a => a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo);
            if (scope.SedaSchoolNames is not null)
                query = query.Where(a => scope.SedaSchoolNames.Contains(a.SchoolName));

            var seda = await query
                .Select(a => new Rec("seda", a.CreatedAt, a.Status, null, a.BirthDate, a.Tckn))
                .ToListAsync(ct);
            list.AddRange(seda);
        }

        if (Allowed("library"))
        {
            var query = db.LibraryApplications.AsNoTracking()
                .Where(a => a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo);
            if (scope.LibraryIds is not null)
                query = query.Where(a => a.LibraryId.HasValue && scope.LibraryIds.Contains(a.LibraryId.Value));

            var library = await query
                .Select(a => new Rec("library", a.CreatedAt, a.Status, null, null, null))
                .ToListAsync(ct);
            list.AddRange(library);
        }

        if (Allowed("muhtarlik"))
        {
            var query = db.CitizenSubmissions.AsNoTracking()
                .Where(a => a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo);
            if (scope.MuhtarlikNeighborhoods is not null)
                query = query.Where(a => scope.MuhtarlikNeighborhoods.Contains(a.Neighborhood));

            var muhtarlik = await query
                .Select(a => new Rec("muhtarlik", a.CreatedAt, a.Status, null, null, null))
                .ToListAsync(ct);
            list.AddRange(muhtarlik);
        }

        return list;
    }

    private static List<KpiDto> BuildKpis(List<Rec> curr, List<Rec> prev)
    {
        int Count(List<Rec> src) => src.Count;
        int Approved(List<Rec> src) => src.Count(r => r.Status is "approved" or "active" or "confirmed" or "resolved" or "completed");
        int Pending(List<Rec> src) => src.Count(r => r.Status is "pending" or "new" or "waitlist");
        int People(List<Rec> src) => src.Where(r => r.Tckn != null).Select(r => r.Tckn).Distinct().Count();

        return
        [
            Kpi("total", "Toplam Başvuru", Count(curr), Count(prev)),
            Kpi("approved", "Onaylanan", Approved(curr), Approved(prev)),
            Kpi("pending", "Bekleyen", Pending(curr), Pending(prev)),
            Kpi("people", "Tekil Kişi", People(curr), People(prev)),
        ];
    }

    private static KpiDto Kpi(string key, string label, int cur, int prev)
        => new(key, label, cur, prev, prev == 0 ? (cur > 0 ? 100 : 0) : Math.Round((cur - prev) * 100.0 / prev, 1));

    private static string Normalize(string? g)
        => g?.ToLowerInvariant() switch { "week" => "week", "month" => "month", _ => "day" };

    private static List<TrendPointDto> BuildTrend(List<Rec> curr, DateTime from, DateTime to, string groupBy, HashSet<string>? allowedModules)
    {
        // Trend "gün" kovaları da Türkiye yerel gününe göre gruplanır (UTC ham tarihine göre
        // gruplamak bir günlük kayma yaratıyordu — ReportsService.BuildTrend'deki aynı düzeltme).
        DateTime Bucket(DateTime utc)
        {
            var local = TurkeyTime.ToTurkey(utc).Date;
            return groupBy switch
            {
                "month" => new DateTime(local.Year, local.Month, 1),
                "week" => local.AddDays(-(int)((local.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)local.DayOfWeek) - 1)),
                _ => local,
            };
        }

        var byBucket = curr
            .GroupBy(r => Bucket(r.CreatedAt))
            .ToDictionary(g => g.Key, g => g.GroupBy(x => x.Module).ToDictionary(x => x.Key, x => x.Count()));

        var points = new List<TrendPointDto>();
        var cursor = Bucket(from);
        var end = Bucket(to);
        var guard = 0;
        while (cursor <= end && guard++ < 800)
        {
            var values = byBucket.TryGetValue(cursor, out var v) ? v : new Dictionary<string, int>();
            foreach (var (key, _) in Modules)
                if (allowedModules is null || allowedModules.Contains(key))
                    values.TryAdd(key, 0);
            points.Add(new TrendPointDto(cursor.ToString("yyyy-MM-dd"), values));
            cursor = groupBy switch { "month" => cursor.AddMonths(1), "week" => cursor.AddDays(7), _ => cursor.AddDays(1) };
        }
        return points;
    }

    private static List<ModuleBreakdownDto> BuildModules(List<Rec> curr, List<Rec> prev, HashSet<string>? allowedModules)
        => Modules.Where(m => allowedModules is null || allowedModules.Contains(m.Key)).Select(m => new ModuleBreakdownDto(
            m.Key, m.Label,
            curr.Count(r => r.Module == m.Key),
            prev.Count(r => r.Module == m.Key))).ToList();

    private static GenderSliceDto BuildGender(List<Rec> curr)
        => new(
            curr.Count(r => r.Gender == Gender.Male),
            curr.Count(r => r.Gender == Gender.Female),
            curr.Count(r => r.Gender == null));

    private static List<AgeBucketDto> BuildAges(List<Rec> curr)
    {
        var now = DateTime.UtcNow;
        int Age(DateTime b) { var a = now.Year - b.Year; if (b.Date > now.AddYears(-a)) a--; return a; }
        string Bucket(int a) => a switch
        {
            <= 12 => "0-12", <= 17 => "13-17", <= 25 => "18-25",
            <= 40 => "26-40", <= 60 => "41-60", _ => "60+",
        };
        var order = new[] { "0-12", "13-17", "18-25", "26-40", "41-60", "60+" };
        // UYE-RPT-001 canlı testinde ReportsService.BuildAgesAsync'de bulunan aynı tutarsızlık burada
        // da mevcuttu: BirthDate'i olmayan kayıtlar sessizce atlanıyordu, bu da BuildGender'ın (null'ı
        // "unknown" olarak sayan) toplamıyla tutarsız oluyordu. Aynı düzeltme: bilinmeyen yaş "Bilinmiyor"
        // bucket'ına ekleniyor, toplam korunuyor.
        var counts = curr.Where(r => r.BirthDate.HasValue)
            .GroupBy(r => Bucket(Age(r.BirthDate!.Value)))
            .ToDictionary(g => g.Key, g => g.Count());
        var known = counts.Values.Sum();
        var unknown = curr.Count - known;
        var result = order.Select(o => new AgeBucketDto(o, counts.GetValueOrDefault(o))).ToList();
        if (unknown > 0)
            result.Add(new AgeBucketDto("Bilinmiyor", unknown));
        return result;
    }

    private static NationalityDto BuildNationality(List<Rec> curr)
    {
        var withTckn = curr.Where(r => !string.IsNullOrWhiteSpace(r.Tckn)).ToList();
        return new NationalityDto(
            withTckn.Count(r => !r.Tckn!.StartsWith("99")),
            withTckn.Count(r => r.Tckn!.StartsWith("99")),
            curr.Count - withTckn.Count);
    }

    private async Task<RatingDto> BuildRatingAsync(DateTime rangeFrom, DateTime rangeTo, AnalyticsScope scope, CancellationToken ct)
    {
        var eventsAllowed = scope.IsUnscoped || scope.AllowedModules!.Contains("events");
        var travelsAllowed = scope.IsUnscoped || scope.AllowedModules!.Contains("travels");
        if (!eventsAllowed && !travelsAllowed) return new RatingDto(0, [0, 0, 0, 0, 0], 0);

        var eventRatingsQuery = db.EventReviews.AsNoTracking()
            .Where(r => eventsAllowed && r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo);
        if (eventsAllowed && scope.EventIds is not null)
            eventRatingsQuery = eventRatingsQuery.Where(r => scope.EventIds.Contains(r.EventId));

        var travelRatingsQuery = db.TravelReviews.AsNoTracking()
            .Where(r => travelsAllowed && r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo);
        if (travelsAllowed && scope.TravelIds is not null)
            travelRatingsQuery = travelRatingsQuery.Where(r => scope.TravelIds.Contains(r.TravelId));

        var ratings = await eventRatingsQuery
            .Select(r => r.Rating)
            .Concat(travelRatingsQuery.Select(r => r.Rating))
            .ToListAsync(ct);

        var dist = new List<int> { 0, 0, 0, 0, 0 };
        foreach (var r in ratings)
            if (r is >= 1 and <= 5) dist[r - 1]++;
        var avg = ratings.Count > 0 ? Math.Round(ratings.Average(), 2) : 0;
        return new RatingDto(avg, dist, ratings.Count);
    }

    private async Task<(List<TopProgramDto> Demand, List<TopProgramDto> Rated)> BuildTopProgramsAsync(DateTime rangeFrom, DateTime rangeTo, AnalyticsScope scope, CancellationToken ct)
    {
        if (!scope.IsUnscoped && !scope.AllowedModules!.Contains("events")) return ([], []);

        var demandQuery =
            from a in db.EventApplications.AsNoTracking()
            where a.CreatedAt >= rangeFrom && a.CreatedAt <= rangeTo
            join e in db.Events.AsNoTracking() on a.EventId equals e.Id
            select new { a, e };
        if (scope.EventIds is not null)
            demandQuery = demandQuery.Where(x => scope.EventIds.Contains(x.a.EventId));

        var eventCounts = await demandQuery
            .GroupBy(x => new { x.e.Id, x.e.Name, x.e.Capacity })
            .Select(g => new { g.Key.Name, g.Key.Capacity, Applications = g.Count() }).ToListAsync(ct);

        var demand = eventCounts
            .OrderByDescending(x => x.Applications)
            .Take(6)
            .Select(x => new TopProgramDto("events", "Etkinlik", x.Name, x.Applications, x.Capacity,
                x.Capacity > 0 ? (int)Math.Round(Math.Min(x.Applications, x.Capacity) * 100.0 / x.Capacity) : 0, 0, 0))
            .ToList();

        // Denetim düzeltmesi (2026-08-31): "En Çok Beğenilen Programlar" listesi seçilen tarih
        // aralığını (rangeFrom/rangeTo) TAMAMEN yok sayıyordu — EventReviews sorgusunda hiçbir
        // tarih filtresi yoktu, bu yüzden "bu ay"/"bu hafta" seçili olsa bile sonuç her zaman
        // etkinliğin TÜM ZAMANLAR ortalamasını gösteriyordu (ReportsService.BuildTopItemsAsync'te
        // aynı sorgu doğru şekilde tarih filtreli). Ayrıca scope kontrolü de eksikti (events
        // scope'lu bir kullanıcı, kapsamı dışındaki etkinliklerin değerlendirme ortalamasını
        // görebiliyordu).
        var ratedQuery =
            from r in db.EventReviews.AsNoTracking()
            where r.CreatedAt >= rangeFrom && r.CreatedAt <= rangeTo
            join e in db.Events.AsNoTracking() on r.EventId equals e.Id
            select new { r, e };
        if (scope.EventIds is not null)
            ratedQuery = ratedQuery.Where(x => scope.EventIds.Contains(x.r.EventId));

        var eventRatings = await ratedQuery
            .GroupBy(x => new { x.e.Id, x.e.Name })
            .Select(g => new { g.Key.Name, Avg = g.Average(x => x.r.Rating), Count = g.Count() }).ToListAsync(ct);

        var rated = eventRatings
            .Where(x => x.Count > 0)
            .OrderByDescending(x => x.Avg).ThenByDescending(x => x.Count)
            .Take(6)
            .Select(x => new TopProgramDto("events", "Etkinlik", x.Name, 0, 0, 0, Math.Round(x.Avg, 2), x.Count))
            .ToList();

        return (demand, rated);
    }

    public async Task<DashboardActivityDto> GetDashboardActivityAsync(CancellationToken ct)
    {
        var scope = await ResolveScopeAsync(ct);
        bool Allowed(string module) => scope.IsUnscoped || scope.AllowedModules!.Contains(module);
        var today = TurkeyTime.TodayStartUtc();

        // 2026-07-30 denetiminde eklendi: recentMembers ve recentLogins hiçbir scope
        // filtrelemesine tabi değildi — sadece dashboard.view izniyle, sınırlı yetkili
        // (scope'lu) bir admin bile TÜM katılımcıların en yeni kayıtlarını ve TÜM
        // adminlerin (IP adresi dahil) giriş/çıkış geçmişini görebiliyordu. Diğer tüm
        // alanlar (recentApplications, moduleSummaries, recentEvents) zaten doğru
        // şekilde scope'lanmıştı.
        var scopedParticipantIds = currentUser.Id is Guid callerId
            ? await userScope.GetScopedParticipantIdsAsync(callerId, ct)
            : null;

        var recentMembersQuery = db.Participants.AsNoTracking().AsQueryable();
        if (scopedParticipantIds is not null)
            recentMembersQuery = recentMembersQuery.Where(p => scopedParticipantIds.Contains(p.Id));

        var recentMembers = await recentMembersQuery
            .OrderByDescending(p => p.RegisteredAt)
            .Take(8)
            .Select(p => new RecentMemberDto(p.Id, p.FullName, p.Phone, p.District, p.RegisteredAt))
            .ToListAsync(ct);

        var recentEventsQuery = Allowed("events")
            ? (from e in db.Events.AsNoTracking()
               join c in db.EventCategories.AsNoTracking() on e.CategoryId equals c.Id into cj
               from c in cj.DefaultIfEmpty()
               select new { e, c })
            : null;
        if (recentEventsQuery is not null && scope.EventIds is not null)
            recentEventsQuery = recentEventsQuery.Where(x => scope.EventIds.Contains(x.e.Id));

        var recentEvents = recentEventsQuery is not null
            ? await recentEventsQuery
                .OrderByDescending(x => x.e.CreatedAt)
                .Take(6)
                .Select(x => new RecentEventDto(x.e.Id, x.e.Name, x.c != null ? x.c.Name : "—", x.e.StartDate, x.e.RegisteredCount, x.e.Capacity))
                .ToListAsync(ct)
            : [];

        // recentLogins (yönetici oturum geçmişi, IP adresi dahil) sistem-geneli bir
        // veridir ve gerçek bir "scope" kavramı yok — bu yüzden sadece tam yetkili
        // (scope kısıtlaması olmayan) kullanıcılara gösterilir. Scope'lu personel için
        // boş liste döner (önceden TÜM adminlerin giriş kayıtlarını görebiliyordu).
        var recentLogins = scope.IsUnscoped
            ? await db.AuditLogs.AsNoTracking()
                .Where(a => a.Action == AuditAction.Login || a.Action == AuditAction.Logout)
                .OrderByDescending(a => a.CreatedAt)
                .Take(10)
                .Select(a => new RecentLoginDto(
                    a.UserId,
                    a.UserName ?? "—",
                    a.Module == "ParticipantAuth" || a.Module == "Citizen" ? "citizen" : "admin",
                    a.Action == AuditAction.Login ? "login" : "logout",
                    a.CreatedAt,
                    a.IpAddress))
                .ToListAsync(ct)
            : [];

        var recentApplications = await CollectRecentApplicationsAsync(scope, ct);
        var moduleSummaries = await CollectModuleSummariesAsync(scope, today, ct);
        var globalStats = await BuildGlobalStatsAsync(scope, scopedParticipantIds, today, ct);

        return new DashboardActivityDto(recentMembers, recentEvents, recentLogins, recentApplications, moduleSummaries, globalStats);
    }

    private async Task<GlobalStatsDto> BuildGlobalStatsAsync(
        AnalyticsScope scope,
        IReadOnlyCollection<Guid>? scopedParticipantIds,
        DateTime today,
        CancellationToken ct)
    {
        bool Allowed(string module) => scope.IsUnscoped || scope.AllowedModules!.Contains(module);
        var todayLocal = TurkeyTime.ToTurkey(today).Date;
        var weekStartLocal = todayLocal.AddDays(-(int)((todayLocal.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)todayLocal.DayOfWeek) - 1));
        var monthStartLocal = new DateTime(todayLocal.Year, todayLocal.Month, 1);
        var weekStart = TurkeyTime.ToUtc(weekStartLocal);
        var monthStart = TurkeyTime.ToUtc(monthStartLocal);

        var participantsQuery = db.Participants.AsNoTracking().AsQueryable();
        if (scopedParticipantIds is not null)
        {
            var ids = scopedParticipantIds;
            participantsQuery = participantsQuery.Where(p => ids.Contains(p.Id));
        }
        var totalParticipants = await participantsQuery.CountAsync(ct);
        var newToday = await participantsQuery.CountAsync(p => p.RegisteredAt >= today, ct);
        var newWeek = await participantsQuery.CountAsync(p => p.RegisteredAt >= weekStart, ct);
        var newMonth = await participantsQuery.CountAsync(p => p.RegisteredAt >= monthStart, ct);

        var totalEvents = 0;
        var activeEvents = 0;
        var eventsThisMonth = 0;
        if (Allowed("events"))
        {
            var eventsQuery = db.Events.AsNoTracking().AsQueryable();
            if (scope.EventIds is not null)
                eventsQuery = eventsQuery.Where(e => scope.EventIds.Contains(e.Id));
            totalEvents = await eventsQuery.CountAsync(ct);
            activeEvents = await eventsQuery.CountAsync(e => e.IsActive, ct);
            eventsThisMonth = await eventsQuery.CountAsync(e => e.CreatedAt >= monthStart, ct);
        }

        LibraryGlobalSummaryDto? library = null;
        if (Allowed("library"))
        {
            var libsQuery = db.Set<Nexora.Domain.Entities.Libraries.Library>()
                .AsNoTracking().Where(l => !l.IsDeleted);
            if (scope.LibraryIds is not null)
                libsQuery = libsQuery.Where(l => scope.LibraryIds.Contains(l.Id));

            var libs = await libsQuery
                .Select(l => new { l.Id, l.IsActive, l.Capacity })
                .ToListAsync(ct);
            var totalLibraries = libs.Count;
            var activeLibraries = libs.Count(l => l.IsActive);
            var totalCapacity = libs.Where(l => l.IsActive).Sum(l => l.Capacity);
            var libIds = libs.Select(l => l.Id).ToList();

            var sessions = db.LibrarySessions.AsNoTracking().Where(s => !s.IsDeleted);
            if (scope.LibraryIds is not null)
                sessions = sessions.Where(s => libIds.Contains(s.LibraryId));

            var currentOccupancy = await sessions.CountAsync(s => s.Status == Nexora.Domain.Entities.Libraries.LibrarySessionStatus.Inside, ct);
            var onBreakNow = await sessions.CountAsync(s =>
                s.Status == Nexora.Domain.Entities.Libraries.LibrarySessionStatus.OnBreakShort ||
                s.Status == Nexora.Domain.Entities.Libraries.LibrarySessionStatus.OnBreakLong, ct);

            var waitingQuery = db.Set<Nexora.Domain.Entities.Libraries.LibraryQueueEntry>()
                .AsNoTracking().Where(q => !q.IsDeleted && q.Status == "waiting");
            if (scope.LibraryIds is not null)
                waitingQuery = waitingQuery.Where(q => libIds.Contains(q.LibraryId));
            var waitingNow = await waitingQuery.CountAsync(ct);

            var occupancyRate = totalCapacity > 0 ? Math.Round(currentOccupancy * 100.0 / totalCapacity, 1) : 0;

            var visitsToday = await sessions.CountAsync(s => s.EntryTime >= today, ct);
            var visitsThisMonth = await sessions.CountAsync(s => s.EntryTime >= monthStart, ct);
            var completedThisMonth = await sessions
                .Where(s => s.EntryTime >= monthStart && s.ExitTime != null)
                .Select(s => new { s.EntryTime, s.ExitTime })
                .ToListAsync(ct);
            var avgSessionMinutes = completedThisMonth.Count > 0
                ? Math.Round(completedThisMonth.Average(s => (s.ExitTime!.Value - s.EntryTime).TotalMinutes), 1)
                : 0.0;

            library = new LibraryGlobalSummaryDto(
                totalLibraries, activeLibraries, totalCapacity, currentOccupancy, onBreakNow, waitingNow,
                occupancyRate, visitsToday, visitsThisMonth, avgSessionMinutes);
        }

        return new GlobalStatsDto(totalParticipants, newToday, newWeek, newMonth, totalEvents, activeEvents, eventsThisMonth, library);
    }

    private async Task<List<RecentApplicationDto>> CollectRecentApplicationsAsync(AnalyticsScope scope, CancellationToken ct)
    {
        bool Allowed(string module) => scope.IsUnscoped || scope.AllowedModules!.Contains(module);
        var list = new List<RecentApplicationDto>();

        if (Allowed("events"))
        {
            var q = from a in db.EventApplications.AsNoTracking()
                    join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                    from pt in pj.DefaultIfEmpty()
                    join e in db.Events.AsNoTracking() on a.EventId equals e.Id into ej
                    from e in ej.DefaultIfEmpty()
                    select new { a, pt, e };
            if (scope.EventIds is not null)
                q = q.Where(x => scope.EventIds.Contains(x.a.EventId));

            var events = await q
                .OrderByDescending(x => x.a.CreatedAt)
                .Take(5)
                .Select(x => new RecentApplicationDto("events", "Etkinlik", x.a.Id,
                    x.pt != null ? x.pt.FullName : "—", x.e != null ? x.e.Name : null, x.a.Status, x.a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(events);
        }

        if (Allowed("facilities"))
        {
            var q = ApplyFacilityScope(db.FacilityApplications.AsNoTracking(), scope);

            var facilities = await q
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .Select(a => new RecentApplicationDto("facilities", "Tesis Programları", a.Id, a.FullName, a.Module, a.Status, a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(facilities);
        }

        if (Allowed("travels"))
        {
            var q = from a in db.TravelApplications.AsNoTracking()
                    join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
                    from pt in pj.DefaultIfEmpty()
                    join t in db.Travels.AsNoTracking() on a.TravelId equals t.Id into tj
                    from t in tj.DefaultIfEmpty()
                    select new { a, pt, t };
            if (scope.TravelIds is not null)
                q = q.Where(x => scope.TravelIds.Contains(x.a.TravelId));

            var travels = await q
                .OrderByDescending(x => x.a.CreatedAt)
                .Take(5)
                .Select(x => new RecentApplicationDto("travels", "Gezi", x.a.Id,
                    x.pt != null ? x.pt.FullName : "—", x.t != null ? x.t.Name : null, x.a.Status, x.a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(travels);
        }

        if (Allowed("seda"))
        {
            var q = db.SedaApplications.AsNoTracking().AsQueryable();
            if (scope.SedaSchoolNames is not null)
                q = q.Where(a => scope.SedaSchoolNames.Contains(a.SchoolName));

            var seda = await q
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .Select(a => new RecentApplicationDto("seda", "SEDA Eğitim", a.Id, a.StudentName + " " + a.StudentSurname, a.SchoolName, a.Status, a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(seda);
        }

        if (Allowed("library"))
        {
            var q = db.LibraryApplications.AsNoTracking().AsQueryable();
            if (scope.LibraryIds is not null)
                q = q.Where(a => a.LibraryId.HasValue && scope.LibraryIds.Contains(a.LibraryId.Value));

            var library = await q
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .Select(a => new RecentApplicationDto("library", "Kütüphane", a.Id, a.ApplicantName + " " + a.ApplicantSurname, a.MembershipType, a.Status, a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(library);
        }

        if (Allowed("muhtarlik"))
        {
            var q = db.CitizenSubmissions.AsNoTracking().AsQueryable();
            if (scope.MuhtarlikNeighborhoods is not null)
                q = q.Where(a => scope.MuhtarlikNeighborhoods.Contains(a.Neighborhood));

            var muhtarlik = await q
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .Select(a => new RecentApplicationDto("muhtarlik", "Muhtarlık", a.Id, a.CitizenName, a.Title, a.Status, a.CreatedAt))
                .ToListAsync(ct);
            list.AddRange(muhtarlik);
        }

        return list.OrderByDescending(a => a.CreatedAt).Take(10).ToList();
    }

    private async Task<List<ModuleRecordSummaryDto>> CollectModuleSummariesAsync(AnalyticsScope scope, DateTime today, CancellationToken ct)
    {
        bool Allowed(string module) => scope.IsUnscoped || scope.AllowedModules!.Contains(module);
        var result = new List<ModuleRecordSummaryDto>();

        foreach (var (key, label) in Modules)
        {
            if (!Allowed(key)) continue;

            (int Total, int Today) counts = key switch
            {
                "events" => await CountAsync(
                    ApplyEventScope(db.EventApplications.AsNoTracking(), scope), today, ct),
                "facilities" => await CountAsync(
                    ApplyFacilityScope(db.FacilityApplications.AsNoTracking(), scope), today, ct),
                "travels" => await CountAsync(
                    ApplyTravelScope(db.TravelApplications.AsNoTracking(), scope), today, ct),
                "seda" => await CountAsync(
                    ApplySedaScope(db.SedaApplications.AsNoTracking(), scope), today, ct),
                "library" => await CountAsync(
                    ApplyLibraryScope(db.LibraryApplications.AsNoTracking(), scope), today, ct),
                "muhtarlik" => await CountAsync(
                    ApplyMuhtarlikScope(db.CitizenSubmissions.AsNoTracking(), scope), today, ct),
                _ => (0, 0),
            };
            result.Add(new ModuleRecordSummaryDto(key, label, counts.Total, counts.Today));
        }

        return result;
    }

    private static async Task<(int Total, int Today)> CountAsync<T>(IQueryable<T> query, DateTime today, CancellationToken ct)
        where T : Domain.Common.BaseEntity
    {
        var total = await query.CountAsync(ct);
        var todayCount = await query.CountAsync(e => e.CreatedAt >= today, ct);
        return (total, todayCount);
    }

    private static IQueryable<Domain.Entities.Events.EventApplication> ApplyEventScope(
        IQueryable<Domain.Entities.Events.EventApplication> query, AnalyticsScope scope)
        => scope.EventIds is null ? query : query.Where(a => scope.EventIds.Contains(a.EventId));

    /// <summary>
    /// Denetim düzeltmesi (2026-09-01, P0-REGRESYON): önceki hali (Dictionary üzerinde
    /// Where/Select/FirstOrDefault zinciri) EF Core'un SQL'e çeviremediği bir ifade üretiyordu
    /// ve /api/v1/analytics/overview dahil TÜM dashboard uçlarını superadmin için bile 500
    /// (ArgumentException: HashSet IQueryable'a çevrilemez) ile kırıyordu — canlı testte
    /// kanıtlandı, önceki denetim turunda hiçbir ajan API'yi yeniden başlatıp gerçek binary ile
    /// test etmediği için bu regresyon fark edilmemişti. Dictionary lookup yerine, izin
    /// verilen her modül için Expression.OrElse ile elle bir OR ağacı kuruluyor — EF Core
    /// `HashSet&lt;Guid&gt;.Contains(Guid)` desenini (capture edilmiş sabit koleksiyon üzerinde)
    /// SQL `= ANY(...)` olarak çevirebiliyor, ama Dictionary indeksleme/LINQ zinciri çeviremiyor.
    /// </summary>
    private static IQueryable<Domain.Entities.Facilities.FacilityApplication> ApplyFacilityScope(
        IQueryable<Domain.Entities.Facilities.FacilityApplication> query, AnalyticsScope scope)
    {
        if (scope.FacilityIdsByModule.Count == 0)
            return query;

        var param = System.Linq.Expressions.Expression.Parameter(typeof(Domain.Entities.Facilities.FacilityApplication), "a");
        var moduleProp = System.Linq.Expressions.Expression.Property(param, nameof(Domain.Entities.Facilities.FacilityApplication.Module));
        var facilityIdProp = System.Linq.Expressions.Expression.Property(param, nameof(Domain.Entities.Facilities.FacilityApplication.FacilityId));
        var containsMethod = typeof(HashSet<Guid>).GetMethod(nameof(HashSet<Guid>.Contains), [typeof(Guid)])!;

        System.Linq.Expressions.Expression? body = null;
        foreach (var (moduleKey, ids) in scope.FacilityIdsByModule)
        {
            System.Linq.Expressions.Expression cond = System.Linq.Expressions.Expression.Equal(
                moduleProp, System.Linq.Expressions.Expression.Constant(moduleKey));
            if (ids is not null)
            {
                var idsConst = System.Linq.Expressions.Expression.Constant(ids, typeof(HashSet<Guid>));
                var containsCall = System.Linq.Expressions.Expression.Call(idsConst, containsMethod, facilityIdProp);
                cond = System.Linq.Expressions.Expression.AndAlso(cond, containsCall);
            }
            body = body is null ? cond : System.Linq.Expressions.Expression.OrElse(body, cond);
        }

        var lambda = System.Linq.Expressions.Expression.Lambda<Func<Domain.Entities.Facilities.FacilityApplication, bool>>(body!, param);
        return query.Where(lambda);
    }

    private static IQueryable<Domain.Entities.Travels.TravelApplication> ApplyTravelScope(
        IQueryable<Domain.Entities.Travels.TravelApplication> query, AnalyticsScope scope)
        => scope.TravelIds is null ? query : query.Where(a => scope.TravelIds.Contains(a.TravelId));

    private static IQueryable<Domain.Entities.Seda.SedaApplication> ApplySedaScope(
        IQueryable<Domain.Entities.Seda.SedaApplication> query, AnalyticsScope scope)
        => scope.SedaSchoolNames is null ? query : query.Where(a => scope.SedaSchoolNames.Contains(a.SchoolName));

    private static IQueryable<Domain.Entities.Libraries.LibraryApplication> ApplyLibraryScope(
        IQueryable<Domain.Entities.Libraries.LibraryApplication> query, AnalyticsScope scope)
        => scope.LibraryIds is null ? query : query.Where(a => a.LibraryId.HasValue && scope.LibraryIds.Contains(a.LibraryId.Value));

    private static IQueryable<Domain.Entities.CitizenSubmissions.CitizenSubmission> ApplyMuhtarlikScope(
        IQueryable<Domain.Entities.CitizenSubmissions.CitizenSubmission> query, AnalyticsScope scope)
        => scope.MuhtarlikNeighborhoods is null ? query : query.Where(a => scope.MuhtarlikNeighborhoods.Contains(a.Neighborhood));

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): "toplam kaç kişi online" bilgisi dashboard'da.
    /// Anlık sayı Redis'ten (son 5 dakika penceresi), trend ve günün zirvesi ise
    /// 5 dakikada bir yazılan kalıcı kayıtlardan okunur.
    /// </summary>
    public async Task<OnlineUsersDto> GetOnlineUsersAsync(int trendHours, CancellationToken ct)
    {
        var snapshot = await onlineTracker.GetSnapshotAsync(ct);

        var hours = Math.Clamp(trendHours, 1, 168);
        var since = DateTime.UtcNow.AddHours(-hours);
        var trend = await db.OnlineUserSnapshots
            .AsNoTracking()
            .Where(x => x.CapturedAt >= since)
            .OrderBy(x => x.CapturedAt)
            .Select(x => new OnlineTrendPointDto(x.CapturedAt, x.TotalOnline))
            .ToListAsync(ct);

        var todayStart = DateTime.UtcNow.Date;
        var peakToday = await db.OnlineUserSnapshots
            .AsNoTracking()
            .Where(x => x.CapturedAt >= todayStart)
            .Select(x => (int?)x.TotalOnline)
            .MaxAsync(ct) ?? 0;

        // Anlık değer henüz kaydedilmemiş olabilir; zirve en az anlık kadar olmalı.
        peakToday = Math.Max(peakToday, snapshot.Total);

        return new OnlineUsersDto(
            snapshot.Total, snapshot.Admin, snapshot.Citizen, snapshot.Company, peakToday, trend,
            snapshot.CitizenIos, snapshot.CitizenAndroid, snapshot.CitizenWeb);
    }
}
