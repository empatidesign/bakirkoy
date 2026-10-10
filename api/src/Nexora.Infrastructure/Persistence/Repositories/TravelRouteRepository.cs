using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelRouteRepository(AppDbContext context)
    : Repository<TravelRoute>(context), ITravelRouteRepository
{
    public async Task<PagedResult<TravelRoute>> GetPagedAsync(TravelRouteListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            // Kullanıcı isteği (2026-09-30): "gerek gezi adı gerek ... genel bir arama" —
            // ana Geziler (Route) listesindeki arama artık sadece gezi adı/hedef değil, o
            // gezinin seferlerine başvurmuş vatandaşın adı/TC'si de eşleştiriyor.
            var routeIdsByApplicant = Context.Set<TravelApplication>()
                .Where(a => Context.Set<Participant>().Any(pt =>
                    pt.Id == a.ParticipantId
                    && (EF.Functions.ILike(pt.FullName, $"%{term}%") || pt.Tckn.Contains(term))))
                .Join(Context.Set<Travel>(), a => a.TravelId, t => t.Id, (a, t) => t.RouteId);
            query = query.Where(e =>
                EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Destination, $"%{term}%")
                || routeIdsByApplicant.Contains(e.Id));
        }
        if (p.CategoryId.HasValue) query = query.Where(e => e.CategoryId == p.CategoryId.Value);
        if (p.IsActive.HasValue) query = query.Where(e => e.IsActive == p.IsActive.Value);

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(e => e.Name) : query.OrderBy(e => e.Name),
            "createdat" => desc ? query.OrderByDescending(e => e.CreatedAt) : query.OrderBy(e => e.CreatedAt),
            _ => query.OrderBy(e => e.Name),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<TravelRoute>> GetOptionsAsync(string? search, CancellationToken ct)
    {
        var query = DbSet.Where(e => e.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Destination, $"%{term}%"));
        }
        return await query.OrderBy(e => e.Name).Take(50).ToListAsync(ct);
    }

    public async Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct)
        => await DbSet.CountAsync(e => e.CategoryId == categoryId, ct);
}
