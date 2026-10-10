using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CitizenSubmissionRepository(AppDbContext context)
    : Repository<CitizenSubmission>(context), ICitizenSubmissionRepository
{
    public async Task<PagedResult<CitizenSubmission>> GetPagedAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p, scopedNeighborhoods: scopedNeighborhoods);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<SubmissionSummaryDto> GetSummaryAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct)
    {
        var agg = await ApplyFilters(DbSet.AsQueryable(), p, ignoreStatusAndFlags: true, scopedNeighborhoods: scopedNeighborhoods)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                New = g.Count(x => x.Status == "new"),
                InReview = g.Count(x => x.Status == "in_review"),
                Forwarded = g.Count(x => x.Status == "forwarded"),
                Resolved = g.Count(x => x.Status == "resolved"),
                Rejected = g.Count(x => x.Status == "rejected"),
                Urgent = g.Count(x => x.Priority == "urgent"),
                NotifyMuhtar = g.Count(x => x.NotifyMuhtar),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new SubmissionSummaryDto(0, 0, 0, 0, 0, 0, 0, 0)
            : new SubmissionSummaryDto(agg.Total, agg.New, agg.InReview, agg.Forwarded, agg.Resolved, agg.Rejected, agg.Urgent, agg.NotifyMuhtar);
    }

    public async Task<List<CitizenSubmission>> GetMapPointsAsync(CitizenSubmissionListParams p, IReadOnlyList<string>? scopedNeighborhoods, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p, scopedNeighborhoods: scopedNeighborhoods);
        return await query
            .Where(x => x.Latitude != null && x.Longitude != null)
            .ToListAsync(ct);
    }

    public async Task<List<CitizenSubmission>> GetForReportsAsync(CancellationToken ct)
        => await DbSet.AsQueryable().ToListAsync(ct);

    private static IQueryable<CitizenSubmission> ApplyFilters(
        IQueryable<CitizenSubmission> query,
        CitizenSubmissionListParams p,
        bool ignoreStatusAndFlags = false,
        IReadOnlyList<string>? scopedNeighborhoods = null)
    {
        if (scopedNeighborhoods is not null)
            query = query.Where(x => scopedNeighborhoods.Contains(x.Neighborhood));

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Title, $"%{term}%") ||
                EF.Functions.ILike(x.CitizenName, $"%{term}%") ||
                EF.Functions.ILike(x.Address, $"%{term}%") ||
                EF.Functions.ILike(x.Neighborhood, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Neighborhood))
            query = query.Where(x => x.Neighborhood == p.Neighborhood);

        if (!string.IsNullOrWhiteSpace(p.SubmissionType))
            query = query.Where(x => x.SubmissionType == p.SubmissionType);

        if (!string.IsNullOrWhiteSpace(p.CategoryId))
            query = query.Where(x => x.CategoryId == p.CategoryId);

        if (!string.IsNullOrWhiteSpace(p.Priority))
            query = query.Where(x => x.Priority == p.Priority);

        if (!ignoreStatusAndFlags)
        {
            if (!string.IsNullOrWhiteSpace(p.Status))
                query = query.Where(x => x.Status == p.Status);

            if (p.NotifyMuhtar == "yes")
                query = query.Where(x => x.NotifyMuhtar);
            else if (p.NotifyMuhtar == "no")
                query = query.Where(x => !x.NotifyMuhtar);
        }

        if (DateOnly.TryParse(p.DateFrom, out var dFrom))
        {
            var fromUtc = TurkeyTime.ToUtc(dFrom.ToDateTime(TimeOnly.MinValue));
            query = query.Where(x => x.SubmittedAt >= fromUtc);
        }

        if (DateOnly.TryParse(p.DateTo, out var dTo))
        {
            var toUtc = TurkeyTime.ToUtc(dTo.AddDays(1).ToDateTime(TimeOnly.MinValue));
            query = query.Where(x => x.SubmittedAt < toUtc);
        }

        if (string.IsNullOrWhiteSpace(p.DateFrom) && string.IsNullOrWhiteSpace(p.DateTo)
            && !string.IsNullOrWhiteSpace(p.DateRange))
        {
            var now = DateTime.UtcNow;
            DateTime? from = p.DateRange switch
            {
                "today" => TurkeyTime.TodayStartUtc(),
                "week" => now.AddDays(-7),
                "month" => now.AddDays(-30),
                _ => null,
            };
            if (from is DateTime f)
                query = query.Where(x => x.SubmittedAt >= f);
        }

        return query;
    }

    private static IQueryable<CitizenSubmission> ApplySort(IQueryable<CitizenSubmission> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "submittedat"  => desc ? query.OrderByDescending(x => x.SubmittedAt)  : query.OrderBy(x => x.SubmittedAt),
            "neighborhood" => desc ? query.OrderByDescending(x => x.Neighborhood) : query.OrderBy(x => x.Neighborhood),
            "priority"     => desc
                ? query.OrderByDescending(x => x.Priority == "urgent" ? 4 : x.Priority == "high" ? 3 : x.Priority == "normal" ? 2 : 1)
                : query.OrderBy(x => x.Priority == "urgent" ? 4 : x.Priority == "high" ? 3 : x.Priority == "normal" ? 2 : 1),
            "status"       => desc ? query.OrderByDescending(x => x.Status)       : query.OrderBy(x => x.Status),
            _              => query.OrderByDescending(x => x.SubmittedAt),
        };
    }

    public async Task<bool> TryApplyForwardDeliveredAsync(Guid id, Guid attemptId, string unit, string trackingNo, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var affected = await DbSet
            .Where(x => x.Id == id && x.UlakbelForwardAttemptId == attemptId && x.UlakbelTrackingNo == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.UlakbelUnit, unit)
                .SetProperty(x => x.UlakbelTrackingNo, trackingNo)
                .SetProperty(x => x.Status, "forwarded")
                .SetProperty(x => x.ForwardedAt, now)
                .SetProperty(x => x.FirstResponseAt, x => x.FirstResponseAt ?? now)
                .SetProperty(x => x.UlakbelForwardState, (string?)null)
                .SetProperty(x => x.UlakbelForwardAttemptId, (Guid?)null)
                .SetProperty(x => x.UlakbelLastAttemptAt, now)
                .SetProperty(x => x.UpdatedAt, now), ct);
        return affected == 1;
    }

    public async Task<bool> TryApplyForwardUnknownAsync(Guid id, Guid attemptId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var affected = await DbSet
            .Where(x => x.Id == id && x.UlakbelForwardAttemptId == attemptId && x.UlakbelForwardState == "sending")
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.UlakbelForwardState, "unknown")
                .SetProperty(x => x.UlakbelLastAttemptAt, now)
                .SetProperty(x => x.UpdatedAt, now), ct);
        return affected == 1;
    }

    public async Task<bool> TryClearForwardSendingAsync(Guid id, Guid attemptId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var affected = await DbSet
            .Where(x => x.Id == id && x.UlakbelForwardAttemptId == attemptId && x.UlakbelForwardState == "sending")
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.UlakbelForwardState, (string?)null)
                .SetProperty(x => x.UlakbelForwardAttemptId, (Guid?)null)
                .SetProperty(x => x.UpdatedAt, now), ct);
        return affected == 1;
    }

    public async Task<Guid?> TryBeginForwardAttemptAsync(Guid id, CancellationToken ct)
    {
        // ULAK-03 (C): başlangıç sahiplenmesi de atomik koşullu UPDATE. Yalnız kayıt HENÜZ iletilmemiş
        // (trackingNo null) VE askıda değil (state null) ise yeni bir deneme başlatılır. 0 satır = araya
        // başka bir gönderim/durum girmiş (kilit kaybı) → çağıran conflict üretir, tam-satır ezme olmaz.
        var attemptId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var affected = await DbSet
            .Where(x => x.Id == id && x.UlakbelTrackingNo == null && x.UlakbelForwardState == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.UlakbelForwardState, "sending")
                .SetProperty(x => x.UlakbelForwardAttemptId, (Guid?)attemptId)
                .SetProperty(x => x.UlakbelLastAttemptAt, now)
                .SetProperty(x => x.UpdatedAt, now), ct);
        return affected == 1 ? attemptId : null;
    }

    public async Task<bool> TryResetForwardStateAsync(Guid id, Guid? expectedAttemptId, CancellationToken ct)
    {
        // ULAK-03 (B): reset yalnız operatörün gördüğü denemeyi (expectedAttemptId) temizler. Gecikmiş bir
        // reset, araya girmiş YENİ bir denemeyi (farklı attempt-id) temizleyemez → 0 satır → RESET_STATE_CHANGED.
        var now = DateTime.UtcNow;
        var affected = await DbSet
            .Where(x => x.Id == id && x.UlakbelTrackingNo == null
                && x.UlakbelForwardAttemptId == expectedAttemptId
                && (x.UlakbelForwardState == "sending" || x.UlakbelForwardState == "unknown"))
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.UlakbelForwardState, (string?)null)
                .SetProperty(x => x.UlakbelForwardAttemptId, (Guid?)null)
                .SetProperty(x => x.UpdatedAt, now), ct);
        return affected == 1;
    }

    public async Task<CitizenSubmission?> GetByIdFreshAsync(Guid id, CancellationToken ct) =>
        await DbSet.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task MarkSlaWarningNotifiedAsync(Guid id, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await DbSet
            .Where(x => x.Id == id && x.SlaWarningNotifiedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.SlaWarningNotifiedAt, now)
                .SetProperty(x => x.UpdatedAt, now), ct);
    }

    public async Task MarkSlaBreachNotifiedAsync(Guid id, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await DbSet
            .Where(x => x.Id == id && x.SlaBreachNotifiedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.SlaBreachNotifiedAt, now)
                .SetProperty(x => x.UpdatedAt, now), ct);
    }
}
