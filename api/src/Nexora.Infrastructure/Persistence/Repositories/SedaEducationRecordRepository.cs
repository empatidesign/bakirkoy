using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaEducationRecordRepository(AppDbContext context)
    : Repository<SedaEducationRecord>(context), ISedaEducationRecordRepository
{
    private readonly AppDbContext _context = context;

    public async Task<PagedResult<SedaEducationRecordDto>> GetPagedAsync(SedaEducationRecordListParams p, CancellationToken ct)
    {
        var query = ApplySort(BuildFilterQuery(p), p.Sort, p.Order);
        var page = Math.Max(1, p.PageResolved);
        var limit = Math.Clamp(p.LimitResolved, 1, 100);
        var total = await query.CountAsync(ct);
        var items = await Project(query.Skip((page - 1) * limit).Take(limit)).ToListAsync(ct);
        return new PagedResult<SedaEducationRecordDto>
        {
            Items = items,
            Total = total,
            Page = page,
            Limit = limit,
        };
    }

    public async Task<List<SedaEducationRecordDto>> GetAllFilteredAsync(SedaEducationRecordListParams p, CancellationToken ct)
        => await Project(ApplySort(BuildFilterQuery(p), p.Sort, p.Order)).ToListAsync(ct);

    public async Task<List<SedaEducationRecord>> GetByYearAsync(string academicYear, CancellationToken ct)
        => await DbSet.Where(r => r.AcademicYear == academicYear).ToListAsync(ct);

    public async Task<List<SedaEducationRecord>> GetByPeriodAsync(Guid periodId, CancellationToken ct)
        => await DbSet.Where(r => r.PeriodId == periodId).ToListAsync(ct);

    public async Task<List<string>> GetYearsAsync(CancellationToken ct)
        => await DbSet.Select(r => r.AcademicYear).Distinct().OrderByDescending(y => y).ToListAsync(ct);

    public async Task<List<SedaEducationRecord>> GetByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.Where(r => r.Tckn == tckn).OrderByDescending(r => r.AcademicYear).ToListAsync(ct);

    // Kullanıcı isteği (2026-08-12): "vatandaşlar kendi portalında telefon numaraları ile
    // sorgulayabilmesi" — Excel'de Phone doldurulmuşsa TCKN'ye ek/yedek bir eşleşme yolu.
    public async Task<List<SedaEducationRecord>> GetByPhoneAsync(string phone, CancellationToken ct)
        => await DbSet.Where(r => r.Phone == phone).OrderByDescending(r => r.AcademicYear).ToListAsync(ct);

    public async Task<Dictionary<string, Guid>> GetParticipantIdsByTcknsAsync(List<string> tckns, CancellationToken ct)
    {
        if (tckns.Count == 0) return [];
        var rows = await _context.Participants
            .Where(x => tckns.Contains(x.Tckn))
            .Select(x => new { x.Tckn, x.Id })
            .ToListAsync(ct);
        return rows
            .GroupBy(x => x.Tckn)
            .ToDictionary(g => g.Key, g => g.First().Id);
    }

    private IQueryable<SedaEducationRecordDto> Project(IQueryable<SedaEducationRecord> query)
        => from r in query
           join pa in _context.Participants on r.ParticipantId equals pa.Id into g
           from pa in g.DefaultIfEmpty()
           join pe in _context.SedaPeriods on r.PeriodId equals pe.Id into pg
           from pe in pg.DefaultIfEmpty()
           select new SedaEducationRecordDto(r.Id, r.Tckn, r.FullName, r.AcademicYear, r.ParticipantId, pa != null ? pa.FullName : null, r.PeriodId, pe != null ? pe.Name : null, r.Score, r.ResultNote, r.Rank, r.Phone, r.IsWinner, r.DetailsJson, r.CreatedAt);

    private IQueryable<SedaEducationRecord> BuildFilterQuery(SedaEducationRecordListParams p)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.AcademicYear))
            query = query.Where(r => r.AcademicYear == p.AcademicYear);
        if (p.PeriodId.HasValue)
            query = query.Where(r => r.PeriodId == p.PeriodId.Value);
        if (p.MatchedResolved is bool matched)
            query = matched ? query.Where(r => r.ParticipantId != null) : query.Where(r => r.ParticipantId == null);
        if (p.WinnerResolved is bool winner)
            query = query.Where(r => r.IsWinner == winner);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(r =>
                r.Tckn.Contains(term) ||
                EF.Functions.ILike(r.FullName, $"%{term}%"));
        }

        return query;
    }


    private static IQueryable<SedaEducationRecord> ApplySort(IQueryable<SedaEducationRecord> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "tckn"         => desc ? query.OrderByDescending(r => r.Tckn)         : query.OrderBy(r => r.Tckn),
            "fullname"     => desc ? query.OrderByDescending(r => r.FullName)     : query.OrderBy(r => r.FullName),
            "academicyear" => desc ? query.OrderByDescending(r => r.AcademicYear) : query.OrderBy(r => r.AcademicYear),
            _              => desc ? query.OrderByDescending(r => r.CreatedAt)    : query.OrderBy(r => r.CreatedAt),
        };
    }
}
