using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Public;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventRepository(AppDbContext context)
    : Repository<Event>(context), IEventRepository
{
    public async Task<PagedResult<Event>> GetPagedAsync(EventListParams p, CancellationToken ct, HashSet<Guid>? scopedIds = null)
    {
        var query = await BuildFilteredQueryAsync(p, ct);
        if (scopedIds is not null) query = query.Where(e => scopedIds.Contains(e.Id));
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    /// <summary>
    /// Sayfalamasız liste. PaginateAsync limiti 100'e sabitlediği için,
    /// sonucun tamamını bellekte işleyip kendi sayfalamasını yapan
    /// çağrılar (ör. vatandaş "discover") bu yolu kullanır.
    /// </summary>
    public async Task<List<Event>> GetAllFilteredAsync(EventListParams p, CancellationToken ct)
    {
        var query = await BuildFilteredQueryAsync(p, ct);
        return await query.AsNoTracking().ToListAsync(ct);
    }

    /// <summary>Ortak filtre + sıralama; sayfalı ve sayfasız yollar aynı kuralları kullanır.</summary>
    private async Task<IQueryable<Event>> BuildFilteredQueryAsync(EventListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            var facilityIds = await Context.Set<ServiceFacility>()
                .Where(f => EF.Functions.ILike(f.Name, $"%{term}%")).Select(f => f.Id).ToListAsync(ct);
            var hallIds = await Context.Set<Hall>()
                .Where(h => EF.Functions.ILike(h.Name, $"%{term}%")).Select(h => h.Id).ToListAsync(ct);
            // Kullanıcı isteği (2026-09-30): "gerek gezi adı gerek ... genel bir arama" —
            // ana Etkinlikler listesindeki arama artık katılımcı adı/TC'sine göre de eşleşiyor
            // (ör. bir kişinin adını yazınca onun başvurduğu etkinlik(ler) listede çıksın).
            var eventIdsByApplicant = Context.Set<EventApplication>()
                .Where(a => Context.Set<Participant>().Any(pt =>
                    pt.Id == a.ParticipantId
                    && (EF.Functions.ILike(pt.FullName, $"%{term}%") || pt.Tckn.Contains(term))))
                .Select(a => a.EventId);
            query = query.Where(e =>
                EF.Functions.ILike(e.Name, $"%{term}%")
                || EF.Functions.ILike(e.Code, $"%{term}%")
                || (e.FacilityId.HasValue && facilityIds.Contains(e.FacilityId.Value))
                || (e.HallId.HasValue && hallIds.Contains(e.HallId.Value))
                || eventIdsByApplicant.Contains(e.Id));
        }
        if (p.CategoryId.HasValue) query = query.Where(e => e.CategoryId == p.CategoryId.Value);
        if (p.FacilityId.HasValue) query = query.Where(e => e.FacilityId == p.FacilityId.Value);
        if (p.HallId.HasValue) query = query.Where(e => e.HallId == p.HallId.Value);
        if (p.IsActive.HasValue) query = query.Where(e => e.IsActive == p.IsActive.Value);
        if (p.StartDate.HasValue) query = query.Where(e => e.EndDate >= p.StartDate.Value);
        if (p.EndDate.HasValue) query = query.Where(e => e.StartDate <= p.EndDate.Value);
        // Kullanıcı isteği (2026-08-11): gezi/travels modülündeki "Geçmiş Seferleri Göster"
        // filtresiyle aynı desen — aktif etkinlik hariç, bitiş tarihi geçmiş etkinlikler gizlenir.
        if (p.HidePast == true)
        {
            var today = DateTime.UtcNow.Date;
            query = query.Where(e => e.IsActive || e.EndDate.Date >= today);
        }

        return ApplySort(query, p.Sort, p.Order);
    }

    public async Task<PagedResult<Event>> GetTrashAsync(EventListParams p, CancellationToken ct)
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
            "name"      => desc ? query.OrderByDescending(e => e.Name)      : query.OrderBy(e => e.Name),
            "code"      => desc ? query.OrderByDescending(e => e.Code)      : query.OrderBy(e => e.Code),
            _           => query.OrderByDescending(e => e.DeletedAt),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<Event?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('event_code_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<(int Total, int Active, int TotalRegistered, int TotalCapacity)> GetSummaryAsync(EventListParams p, CancellationToken ct)
    {
        var query = await BuildFilteredQueryAsync(p, ct);
        var total = await query.CountAsync(ct);
        var active = await query.CountAsync(e => e.IsActive, ct);
        var capacity = await query.SumAsync(e => e.Capacity, ct);
        var ids = await query.Select(e => e.Id).ToListAsync(ct);
        var registered = ids.Count == 0
            ? 0
            : await Context.Set<EventApplication>().CountAsync(a => !a.IsDeleted && a.Status == "approved" && ids.Contains(a.EventId), ct);
        return (total, active, registered, capacity);
    }

    public async Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct)
        => await DbSet
            .Where(e => categoryIds.Contains(e.CategoryId))
            .GroupBy(e => e.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Count, ct);

    public async Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct)
        => await DbSet.CountAsync(e => e.CategoryId == categoryId, ct);

    public async Task<List<Guid>> GetIdsByFacilityIdsAsync(IList<Guid> facilityIds, CancellationToken ct)
        => await DbSet.Where(e => e.FacilityId.HasValue && facilityIds.Contains(e.FacilityId.Value)).Select(e => e.Id).ToListAsync(ct);

    public void HardRemove(Event entity) => DbSet.Remove(entity);

    public async Task<List<Event>> GetOptionsAsync(string? search, CancellationToken ct)
    {
        var query = DbSet.Where(e => e.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%"));
        }
        return await query.OrderByDescending(e => e.StartDate).Take(50).ToListAsync(ct);
    }

    public async Task<Event?> GetByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.StaticQrCode == code, ct);

    public async Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().AnyAsync(x => x.StaticQrCode == code, ct);

    public async Task<List<Event>> GetPublicDiscoverAsync(PublicEventQuery q, DateTime now, CancellationToken ct)
    {
        var query = DbSet.Where(e => e.IsActive);
        if (!q.IncludePast) query = query.Where(e => e.EndDate >= now.Date);
        if (q.From.HasValue) query = query.Where(e => e.EndDate >= q.From.Value.Date);
        if (q.To.HasValue) { var to = q.To.Value.Date.AddDays(1); query = query.Where(e => e.StartDate <= to); }
        if (q.CategoryId.HasValue) query = query.Where(e => e.CategoryId == q.CategoryId.Value);
        if (q.FacilityId.HasValue) query = query.Where(e => e.FacilityId == q.FacilityId.Value);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var like = $"%{LikeQuery.Escape(q.Search.Trim())}%";
            query = query.Where(e => EF.Functions.ILike(e.Name, like));
        }
        if (!string.IsNullOrWhiteSpace(q.District))
        {
            var district = q.District;
            query = query.Where(e => e.FacilityId != null
                && Context.Set<ServiceFacility>().Any(f => f.Id == e.FacilityId && EF.Functions.ILike(f.District, LikeQuery.Escape(district))));
        }
        var page = Math.Max(1, q.Page);
        var limit = Math.Clamp(q.Limit, 1, 200);
        return await query.OrderBy(e => e.StartDate).ThenBy(e => e.Name)
            .Skip((page - 1) * limit).Take(limit).ToListAsync(ct);
    }

    private static IQueryable<Event> ApplySort(IQueryable<Event> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"       => desc ? query.OrderByDescending(e => e.Name)       : query.OrderBy(e => e.Name),
            "code"       => desc ? query.OrderByDescending(e => e.Code)       : query.OrderBy(e => e.Code),
            "startdate"  => desc ? query.OrderByDescending(e => e.StartDate)  : query.OrderBy(e => e.StartDate),
            "capacity"   => desc ? query.OrderByDescending(e => e.Capacity)   : query.OrderBy(e => e.Capacity),
            "createdat"  => desc ? query.OrderByDescending(e => e.CreatedAt)  : query.OrderBy(e => e.CreatedAt),
            _            => query.OrderByDescending(e => e.StartDate),
        };
    }
}
