using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SmsSendLogRepository(AppDbContext context)
    : Repository<SmsSendLog>(context), ISmsSendLogRepository
{
    public async Task<bool> HasSentTodayAsync(Guid adminUserId, CancellationToken ct)
    {
        var todayStartUtc = DateTime.UtcNow.Date;
        var tomorrowStartUtc = todayStartUtc.AddDays(1);
        return await DbSet.AnyAsync(x =>
            x.AdminUserId == adminUserId &&
            !x.WasBlocked &&
            x.CreatedAt >= todayStartUtc && x.CreatedAt < tomorrowStartUtc, ct);
    }

    public async Task<PagedResult<SmsSendLog>> GetPagedAsync(SmsSendLogListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.AdminUserName, $"%{term}%") ||
                (x.Description != null && EF.Functions.ILike(x.Description, $"%{term}%")) ||
                EF.Functions.ILike(x.Module, $"%{term}%"));
        }

        if (p.AdminUserId.HasValue)
            query = query.Where(x => x.AdminUserId == p.AdminUserId.Value);
        if (!string.IsNullOrWhiteSpace(p.Department))
            query = query.Where(x => x.Department == p.Department);
        if (!string.IsNullOrWhiteSpace(p.Module))
            query = query.Where(x => x.Module == p.Module);
        if (p.WasBlocked.HasValue)
            query = query.Where(x => x.WasBlocked == p.WasBlocked.Value);
        if (p.DateFrom.HasValue)
            query = query.Where(x => x.CreatedAt >= p.DateFrom.Value);
        if (p.DateTo.HasValue)
            query = query.Where(x => x.CreatedAt < p.DateTo.Value.AddDays(1));

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<SmsSendLog> ApplySort(IQueryable<SmsSendLog> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "adminusername" => desc ? query.OrderByDescending(x => x.AdminUserName).ThenByDescending(x => x.CreatedAt) : query.OrderBy(x => x.AdminUserName).ThenBy(x => x.CreatedAt),
            "department"    => desc ? query.OrderByDescending(x => x.Department).ThenByDescending(x => x.CreatedAt)    : query.OrderBy(x => x.Department).ThenBy(x => x.CreatedAt),
            "module"        => desc ? query.OrderByDescending(x => x.Module).ThenByDescending(x => x.CreatedAt)        : query.OrderBy(x => x.Module).ThenBy(x => x.CreatedAt),
            "recipientcount"=> desc ? query.OrderByDescending(x => x.RecipientCount).ThenByDescending(x => x.CreatedAt): query.OrderBy(x => x.RecipientCount).ThenBy(x => x.CreatedAt),
            "createdat" or "date" => desc ? query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)     : query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id),
            _               => desc ? query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)           : query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id),
        };
    }

    public async Task<List<SmsDailyStatDto>> GetDailyStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
    {
        var rows = await DbSet
            .Where(x => x.CreatedAt >= fromUtc && x.CreatedAt < toUtc)
            .GroupBy(x => x.CreatedAt.Date)
            .Select(g => new
            {
                Date = g.Key,
                // Not (2026-09-20): UsedOtp eklenince ayn\u0131 GroupBy projeksiyonunda 5 ayr\u0131
                // Count(predicate) ifadesi Npgsql/EF Core taraf\u0131ndan \u00e7evrilemez hale geldi
                // (InvalidOperationException: could not be translated). Sum(bool ? 1 : 0) deseni
                // ayn\u0131 sonucu verir ve Postgres'e do\u011fru \u00e7evriliyor.
                Sent = g.Sum(x => x.WasBlocked ? 0 : 1),
                Blocked = g.Sum(x => x.WasBlocked ? 1 : 0),
                PinOverrides = g.Sum(x => x.UsedPinOverride && !x.WasBlocked ? 1 : 0),
                OtpVerified = g.Sum(x => x.UsedOtp && !x.WasBlocked ? 1 : 0),
            })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        return rows.Select(r => new SmsDailyStatDto(DateOnly.FromDateTime(r.Date), r.Sent, r.Blocked, r.PinOverrides, r.OtpVerified)).ToList();
    }

    public async Task<List<SmsUserStatDto>> GetUserStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
    {
        // Not (2026-09-20): SmsUserStatDto constructor'ına doğrudan 5+ aggregate ifadesi
        // geçirmek Npgsql/EF Core çevirisini kırıyordu (bkz. GetDailyStatsAsync notu). Önce
        // anonim tipe projekte edip ToListAsync ile materialize ediyoruz, record dönüşümü
        // client tarafında (bellekte) yapılıyor — Postgres'e giden sorgu değişmiyor, sadece
        // sonuç şekillendirmesi ayrılıyor.
        var rows = await DbSet
            .Where(x => x.CreatedAt >= fromUtc && x.CreatedAt < toUtc)
            .GroupBy(x => new { x.AdminUserId, x.AdminUserName, x.Department })
            .Select(g => new
            {
                g.Key.AdminUserId,
                g.Key.AdminUserName,
                g.Key.Department,
                Sent = g.Sum(x => x.WasBlocked ? 0 : 1),
                Blocked = g.Sum(x => x.WasBlocked ? 1 : 0),
                PinOverrides = g.Sum(x => x.UsedPinOverride && !x.WasBlocked ? 1 : 0),
                OtpVerified = g.Sum(x => x.UsedOtp && !x.WasBlocked ? 1 : 0),
                TotalRecipients = g.Where(x => !x.WasBlocked).Sum(x => x.RecipientCount),
            })
            .OrderByDescending(x => x.Sent)
            .ToListAsync(ct);

        return rows.Select(r => new SmsUserStatDto(
            r.AdminUserId, r.AdminUserName, r.Department, r.Sent, r.Blocked, r.PinOverrides, r.OtpVerified, r.TotalRecipients)).ToList();
    }

    public async Task<List<SmsDepartmentStatDto>> GetDepartmentStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
    {
        var rows = await DbSet
            .Where(x => x.CreatedAt >= fromUtc && x.CreatedAt < toUtc)
            .GroupBy(x => x.Department ?? "Departmansız")
            .Select(g => new
            {
                Department = g.Key,
                Sent = g.Sum(x => x.WasBlocked ? 0 : 1),
                Blocked = g.Sum(x => x.WasBlocked ? 1 : 0),
                PinOverrides = g.Sum(x => x.UsedPinOverride && !x.WasBlocked ? 1 : 0),
                OtpVerified = g.Sum(x => x.UsedOtp && !x.WasBlocked ? 1 : 0),
                TotalRecipients = g.Where(x => !x.WasBlocked).Sum(x => x.RecipientCount),
            })
            .OrderByDescending(x => x.Sent)
            .ToListAsync(ct);

        return rows.Select(r => new SmsDepartmentStatDto(
            r.Department, r.Sent, r.Blocked, r.PinOverrides, r.OtpVerified, r.TotalRecipients)).ToList();
    }
}
