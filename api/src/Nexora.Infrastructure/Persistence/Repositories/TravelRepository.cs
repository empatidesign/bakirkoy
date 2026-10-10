using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelRepository(AppDbContext context)
    : Repository<Travel>(context), ITravelRepository
{
    public async Task<PagedResult<Travel>> GetPagedAsync(TravelListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (scopedRefIds is not null)
            query = query.Where(e => scopedRefIds.Contains(e.Id));

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            // Kullanıcı isteği (2026-09-30): "gerek gezi adı gerek ... genel bir arama" —
            // ana Geziler listesindeki arama artık sadece gezi adı/kod/hedef değil, o gezilere
            // başvurmuş vatandaşın adı/TC'si de eşleştiriyor (ör. bir kişinin adını yazınca
            // onun kayıtlı olduğu sefer(ler) listede çıksın).
            var travelIdsByApplicant = Context.Set<TravelApplication>()
                .Where(a => Context.Set<Participant>().Any(pt =>
                    pt.Id == a.ParticipantId
                    && (EF.Functions.ILike(pt.FullName, $"%{term}%") || pt.Tckn.Contains(term))))
                .Select(a => a.TravelId);
            query = query.Where(e =>
                EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Code, $"%{term}%") || EF.Functions.ILike(e.Destination, $"%{term}%")
                || travelIdsByApplicant.Contains(e.Id));
        }
        if (p.CategoryId.HasValue) query = query.Where(e => e.CategoryId == p.CategoryId.Value);
        if (p.RouteId.HasValue) query = query.Where(e => e.RouteId == p.RouteId.Value);
        if (p.IsActive.HasValue) query = query.Where(e => e.IsActive == p.IsActive.Value);
        if (p.StartDate.HasValue) query = query.Where(e => e.StartDate.Date >= p.StartDate.Value.Date);
        if (p.EndDate.HasValue) query = query.Where(e => e.StartDate <= p.EndDate.Value);
        // Kullanıcı isteği (2026-08-07): "pasif geziler süresi geçmiş gezileri göstermesin" —
        // liste varsayılan olarak bitiş tarihi geçmişte kalan seferleri gizler.
        if (p.HidePast == true)
        {
            var today = DateTime.UtcNow.Date;
            query = query.Where(e => e.EndDate.Date >= today);
        }

        // SORUN 6 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
        // p.IsActive==true (yalnızca "aktif" liste — vatandaşın keşfet ekranı ve admin panelin
        // "Aktif" filtresi bunu kullanıyor) istenirken önceden yalnızca Travel.IsActive kontrol
        // ediliyordu, bağlı TravelRoute'un kendi IsActive'i hiç kontrol edilmiyordu — bir admin
        // Route'u pasife aldığında bağlı Travel'lar (kendi IsActive'i hâlâ true kaldığı için)
        // vatandaşa görünmeye devam ediyordu. Route pasif olduğunda Travel de fiilen kapalı
        // sayılmalı (Route içerik/yayın durumunun "üst" otorite olması gerekir).
        if (p.IsActive == true)
        {
            var activeRouteIds = Context.Set<TravelRoute>().Where(r => r.IsActive).Select(r => r.Id);
            query = query.Where(e => activeRouteIds.Contains(e.RouteId));
        }

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<PagedResult<Travel>> GetTrashAsync(TravelListParams p, CancellationToken ct)
    {
        var query = DbSet.IgnoreQueryFilters().Where(e => e.IsDeleted);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Code, $"%{term}%"));
        }

        var desc = !string.Equals(p.Order, "asc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(e => e.Name) : query.OrderBy(e => e.Name),
            "code" => desc ? query.OrderByDescending(e => e.Code) : query.OrderBy(e => e.Code),
            _ => query.OrderByDescending(e => e.DeletedAt),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<Travel?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('travel_code_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<(int Total, int Active, int TotalRegistered, int TotalCapacity, int HeldToDate, int Upcoming)> GetSummaryAsync(Guid? routeId, CancellationToken ct)
    {
        var q = routeId.HasValue ? DbSet.Where(e => e.RouteId == routeId.Value) : DbSet;
        var tomorrow = TurkeyTime.ToUtc(TurkeyTime.TodayDate().AddDays(1));
        var total = await q.CountAsync(ct);
        var active = await q.CountAsync(e => e.IsActive, ct);
        var totalRegistered = await q.SumAsync(e => e.RegisteredCount, ct);
        var totalCapacity = await q.SumAsync(e => e.Capacity, ct);
        var heldToDate = await q.CountAsync(e => e.StartDate < tomorrow, ct);
        var upcoming = await q.CountAsync(e => e.StartDate >= tomorrow, ct);
        return (total, active, totalRegistered, totalCapacity, heldToDate, upcoming);
    }

    public async Task<(double AverageRating, int TotalReviews)> GetRatingSummaryAsync(Guid? routeId, CancellationToken ct)
    {
        var travelIdsQuery = routeId.HasValue
            ? DbSet.Where(e => e.RouteId == routeId.Value).Select(e => e.Id)
            : DbSet.Select(e => e.Id);

        var reviews = Context.Set<Nexora.Domain.Entities.Reviews.TravelReview>()
            .Where(r => travelIdsQuery.Contains(r.TravelId));

        var count = await reviews.CountAsync(ct);
        if (count == 0) return (0, 0);
        var avg = await reviews.AverageAsync(r => (double)r.Rating, ct);
        return (Math.Round(avg, 1), count);
    }

    public async Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct)
        => await DbSet
            .Where(e => categoryIds.Contains(e.CategoryId))
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Count, ct);

    public async Task<Dictionary<Guid, (int Count, int Capacity, int Registered)>> GetStatsByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct)
        => (await DbSet
            .Where(e => categoryIds.Contains(e.CategoryId))
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count(), Capacity = g.Sum(e => e.Capacity), Registered = g.Sum(e => e.RegisteredCount) })
            .ToListAsync(ct))
            .ToDictionary(x => x.CategoryId, x => (x.Count, x.Capacity, x.Registered));

    public async Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct)
        => await DbSet.CountAsync(e => e.CategoryId == categoryId, ct);

    public async Task<Dictionary<Guid, (int Total, int Active)>> GetStatsByRoutesAsync(List<Guid> routeIds, CancellationToken ct)
        => (await DbSet
            .Where(e => routeIds.Contains(e.RouteId))
            .GroupBy(e => e.RouteId)
            .Select(g => new { RouteId = g.Key, Total = g.Count(), Active = g.Count(e => e.IsActive) })
            .ToListAsync(ct))
            .ToDictionary(x => x.RouteId, x => (x.Total, x.Active));

    public async Task<int> CountByRouteAsync(Guid routeId, CancellationToken ct)
        => await DbSet.CountAsync(e => e.RouteId == routeId, ct);

    public async Task<List<Travel>> GetOptionsAsync(string? search, bool includeInactive, CancellationToken ct)
    {
        // SORUN 6 düzeltmesi: burada da aktif Route filtresi uygulanıyor (aynı gerekçe,
        // yukarıdaki GetPagedAsync'teki nota bakın) — bu metod "Yeni Sefer" formundaki
        // Gezi seçim Combobox'ı ve başvuru filtrelerinde kullanılıyor.
        // SORUN 10 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
        // önceden bu metod her zaman yalnızca aktif seferleri döndürüyordu (Where(IsActive)
        // koşulsuz uygulanıyordu) — pasif/geçmiş bir sefer kendi benzersiz koduyla bile
        // aranamıyordu. includeInactive=true ise (katılımcı/başvuru filtreleri gibi geçmiş
        // kayıtları da görmesi gereken çağıranlar için) bu kısıt kaldırılıyor.
        var query = includeInactive
            ? DbSet.AsQueryable()
            : DbSet.Where(e => e.IsActive && Context.Set<TravelRoute>().Where(r => r.IsActive).Select(r => r.Id).Contains(e.RouteId));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Code, $"%{term}%") || EF.Functions.ILike(e.Destination, $"%{term}%"));
        }
        return await query.OrderBy(e => e.Name).Take(50).ToListAsync(ct);
    }

    public void HardRemove(Travel entity) => DbSet.Remove(entity);

    private static IQueryable<Travel> ApplySort(IQueryable<Travel> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(e => e.Name) : query.OrderBy(e => e.Name),
            "code" => desc ? query.OrderByDescending(e => e.Code) : query.OrderBy(e => e.Code),
            "startdate" => desc ? query.OrderByDescending(e => e.StartDate) : query.OrderBy(e => e.StartDate),
            "capacity" => desc ? query.OrderByDescending(e => e.Capacity) : query.OrderBy(e => e.Capacity),
            "createdat" => desc ? query.OrderByDescending(e => e.CreatedAt) : query.OrderBy(e => e.CreatedAt),
            _ => query.OrderByDescending(e => e.StartDate),
        };
    }
}
