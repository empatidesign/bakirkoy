using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class GiftRequestRepository(AppDbContext context)
    : Repository<GiftRequest>(context), IGiftRequestRepository
{
    public async Task<PagedResult<GiftRequest>> GetPagedAsync(GiftRequestListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<GiftRequestSummaryDto> GetSummaryAsync(GiftRequestListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Pending = g.Count(x => x.Status == GiftRequestStatus.Pending),
                Approved = g.Count(x => x.Status == GiftRequestStatus.Approved),
                Rejected = g.Count(x => x.Status == GiftRequestStatus.Rejected),
                Winners = g.Count(x => x.IsWinner),
                WinnersPending = g.Count(x => x.IsWinner && x.Status == GiftRequestStatus.Pending),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new GiftRequestSummaryDto(0, 0, 0, 0, 0, 0)
            : new GiftRequestSummaryDto(agg.Total, agg.Pending, agg.Approved, agg.Rejected, agg.Winners, agg.WinnersPending);
    }

    private static IQueryable<GiftRequest> ApplyFilters(IQueryable<GiftRequest> query, GiftRequestListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = p.Search.Trim();
            var searchTerm = LikeQuery.Escape(term);
            query = query.Where(x =>
                EF.Functions.ILike(x.CitizenName, $"%{searchTerm}%") ||
                x.CitizenTc.Contains(term) ||
                x.CitizenPhone.Contains(term));
        }

        if (Guid.TryParse(p.GiftId, out var giftId) && giftId != Guid.Empty)
            query = query.Where(x => x.GiftId == giftId);

        if (!ignoreStatus)
        {
            switch (p.Status?.ToLowerInvariant())
            {
                case "pending": query = query.Where(x => x.Status == GiftRequestStatus.Pending); break;
                case "approved": query = query.Where(x => x.Status == GiftRequestStatus.Approved); break;
                case "rejected": query = query.Where(x => x.Status == GiftRequestStatus.Rejected); break;
                case "winner": query = query.Where(x => x.IsWinner); break;
                case "winner_pending": query = query.Where(x => x.IsWinner && x.Status == GiftRequestStatus.Pending); break;
            }
        }

        return query;
    }

    private static IQueryable<GiftRequest> ApplySort(IQueryable<GiftRequest> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "ordernumber" => desc ? query.OrderByDescending(x => x.OrderNumber) : query.OrderBy(x => x.OrderNumber),
            "citizenname" => desc ? query.OrderByDescending(x => x.CitizenName) : query.OrderBy(x => x.CitizenName),
            "giftname"    => desc ? query.OrderByDescending(x => x.GiftName)    : query.OrderBy(x => x.GiftName),
            "requestedat" => desc ? query.OrderByDescending(x => x.RequestedAt) : query.OrderBy(x => x.RequestedAt),
            "status"      => desc ? query.OrderByDescending(x => x.Status)      : query.OrderBy(x => x.Status),
            _             => query.OrderByDescending(x => x.RequestedAt),
        };
    }

    public async Task<List<Guid>> GetParticipantIdsByRequestsAsync(IReadOnlyCollection<Guid> requestIds, CancellationToken ct)
    {
        if (requestIds.Count == 0) return [];
        return await DbSet
            .Where(r => requestIds.Contains(r.Id) && r.ParticipantId != null)
            .Select(r => r.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<Guid?> GetGiftIdNoTrackingAsync(Guid requestId, CancellationToken ct)
        => await DbSet.AsNoTracking()
            .Where(r => r.Id == requestId)
            .Select(r => (Guid?)r.GiftId)
            .FirstOrDefaultAsync(ct);
}
