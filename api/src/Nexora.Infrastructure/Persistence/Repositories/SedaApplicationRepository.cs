using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaApplicationRepository(AppDbContext context)
    : Repository<SedaApplication>(context), ISedaApplicationRepository
{
    public async Task<PagedResult<SedaApplication>> GetPagedAsync(SedaApplicationListParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct)
    {
        var query = BuildFilterQuery(p, scopedSchoolNames);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<SedaApplication> ApplySort(IQueryable<SedaApplication> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "code"        => desc ? query.OrderByDescending(a => a.Code)        : query.OrderBy(a => a.Code),
            "studentname" => desc ? query.OrderByDescending(a => a.StudentName) : query.OrderBy(a => a.StudentName),
            "schoolname"  => desc ? query.OrderByDescending(a => a.SchoolName)  : query.OrderBy(a => a.SchoolName),
            "status"      => desc ? query.OrderByDescending(a => a.Status)      : query.OrderBy(a => a.Status),
            "appliedat"   => desc ? query.OrderByDescending(a => a.CreatedAt)   : query.OrderBy(a => a.CreatedAt),
            _             => desc ? query.OrderByDescending(a => a.CreatedAt)   : query.OrderBy(a => a.CreatedAt),
        };
    }

    public async Task<(int Total, int Approved, int Pending, int Rejected)> GetSummaryAsync(string? schoolName, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (!string.IsNullOrWhiteSpace(schoolName))
            query = query.Where(a => a.SchoolName == schoolName);
        if (scopedSchoolNames is not null)
            query = query.Where(a => scopedSchoolNames.Contains(a.SchoolName));

        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Approved = g.Count(a => a.Status == "approved"),
                Pending = g.Count(a => a.Status == "pending"),
                Rejected = g.Count(a => a.Status == "rejected"),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0)
            : (agg.Total, agg.Approved, agg.Pending, agg.Rejected);
    }

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('seda_application_code_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<Dictionary<string, int>> CountBySchoolNamesAsync(List<string> schoolNames, CancellationToken ct)
    {
        if (schoolNames.Count == 0) return [];
        var rows = await DbSet
            .Where(a => schoolNames.Contains(a.SchoolName))
            .GroupBy(a => a.SchoolName)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(x => x.Name, x => x.Count);
    }

    public async Task<List<SedaApplication>> GetAllFilteredAsync(SedaApplicationListParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct)
    {
        var query = BuildFilterQuery(p, scopedSchoolNames);
        query = ApplySort(query, p.Sort, p.Order);
        return await query.ToListAsync(ct);
    }

    private IQueryable<SedaApplication> BuildFilterQuery(SedaApplicationListParams p, IReadOnlyCollection<string>? scopedSchoolNames)
    {
        var query = DbSet.AsQueryable();

        // Yetki alanı (scope) kısıtlı bir kullanıcının kendi okuluna ait olmayan başvurulara
        // erişimini engeller (bkz. seda-scope-idor-2026-07-30 bulgusu, P1 — scope'lu bir
        // kullanıcı önceden sistemdeki TÜM 11.166 SEDA başvurusuna, TC/adres dahil, erişebiliyordu).
        if (scopedSchoolNames is not null)
            query = query.Where(a => scopedSchoolNames.Contains(a.SchoolName));

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(a => a.Status == p.Status);
        if (!string.IsNullOrWhiteSpace(p.EducationType))
            query = query.Where(a => a.EducationType == p.EducationType);
        if (p.GradeList is { Count: > 0 })
            query = query.Where(a => p.GradeList.Contains(a.NextYearGrade));
        else if (!string.IsNullOrWhiteSpace(p.Grade))
            query = query.Where(a => a.NextYearGrade == p.Grade);
        if (!string.IsNullOrWhiteSpace(p.ExamCenterName))
            query = query.Where(a => a.ExamCenterName == p.ExamCenterName);
        if (!string.IsNullOrWhiteSpace(p.SchoolName))
            query = query.Where(a => a.SchoolName == p.SchoolName);
        if (p.StartDate.HasValue)
            query = query.Where(a => a.CreatedAt >= p.StartDate.Value.Date);
        if (p.EndDate.HasValue)
            query = query.Where(a => a.CreatedAt < p.EndDate.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(a =>
                EF.Functions.ILike(a.Code, $"%{term}%") ||
                EF.Functions.ILike(a.StudentName, $"%{term}%") ||
                EF.Functions.ILike(a.StudentSurname, $"%{term}%") ||
                a.Tckn.Contains(term) ||
                EF.Functions.ILike(a.SchoolName, $"%{term}%"));
        }

        return query;
    }

    public async Task<int> CountInWindowAsync(DateTime start, DateTime end, CancellationToken ct)
        => await DbSet.CountAsync(a => a.CreatedAt >= start.Date && a.CreatedAt < end.Date.AddDays(1), ct);

    // SED-CAP/SED-RPT: kota sayacı artık tarih ARALIĞI çakışmasına değil, başvurunun gerçekten hangi
    // döneme AİT olduğuna (PeriodId FK) bakıyor. Eski CountInWindowAsync, aynı gün açılan/kapanan
    // farklı dönemlerin başvurularını birbirine karıştırıyordu (binlerce eski test kaydı "bugün"
    // oluşturulduğu için her yeni dönem anında "dolu" gösteriyordu — canlı test sırasında bulundu).
    public async Task<int> CountByPeriodAsync(Guid periodId, CancellationToken ct)
        => await DbSet.CountAsync(a => a.PeriodId == periodId, ct);

    public async Task<int> CountDistinctSchoolNamesAsync(CancellationToken ct)
        => await DbSet
            .Where(a => a.SchoolName != null && a.SchoolName != "")
            .Select(a => a.SchoolName)
            .Distinct()
            .CountAsync(ct);

    public async Task<PagedResult<SedaApplication>> GetByUserAsync(Guid citizenUserId, int page, int limit, CancellationToken ct)
    {
        var query = DbSet
            .Where(a => a.CitizenUserId == citizenUserId)
            .OrderByDescending(a => a.CreatedAt);
        return await PaginateAsync(query, page, limit, ct);
    }

    public async Task<List<Guid>> GetCitizenUserIdsByApplicationsAsync(IReadOnlyCollection<Guid> applicationIds, CancellationToken ct)
    {
        if (applicationIds.Count == 0) return [];
        return await DbSet
            .Where(a => applicationIds.Contains(a.Id) && a.CitizenUserId != null)
            .Select(a => a.CitizenUserId!.Value)
            .Distinct()
            .ToListAsync(ct);
    }

    // Düzeltme (2026-09-27, kullanıcı bulgusu): periodId verildiğinde kontrol SADECE o
    // döneme ait aktif başvurularla sınırlanır — böylece önceki dönemde approved/pending
    // olan bir vatandaş, yeni açılan bir sonraki döneme serbestçe başvurabilir. periodId
    // null ise (aktif dönem tanımlı değilse) eski dönem-bağımsız davranış korunur.
    public async Task<bool> HasActiveApplicationForCitizenAsync(Guid citizenUserId, Guid? periodId, CancellationToken ct)
        => periodId.HasValue
            ? await DbSet.AnyAsync(a => a.CitizenUserId == citizenUserId && a.PeriodId == periodId.Value && a.Status != "rejected" && a.Status != "cancelled", ct)
            : await DbSet.AnyAsync(a => a.CitizenUserId == citizenUserId && a.Status != "rejected" && a.Status != "cancelled", ct);

    public async Task<bool> HasActiveApplicationForTcknAsync(string tckn, Guid? periodId, CancellationToken ct)
        => periodId.HasValue
            ? await DbSet.AnyAsync(a => a.Tckn == tckn && a.PeriodId == periodId.Value && a.Status != "rejected" && a.Status != "cancelled", ct)
            : await DbSet.AnyAsync(a => a.Tckn == tckn && a.Status != "rejected" && a.Status != "cancelled", ct);

    public async Task<SedaYearlyReportDto> GetYearlyReportAsync(SedaYearlyReportParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (scopedSchoolNames is not null)
            query = query.Where(a => scopedSchoolNames.Contains(a.SchoolName));
        if (!string.IsNullOrWhiteSpace(p.SchoolName))
            query = query.Where(a => a.SchoolName == p.SchoolName);
        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(a => a.Status == p.Status);

        var byYearRaw = await query
            .GroupBy(a => a.CreatedAt.Year)
            .Select(g => new
            {
                Year = g.Key,
                Total = g.Count(),
                Approved = g.Count(a => a.Status == "approved"),
                Pending = g.Count(a => a.Status == "pending"),
                Rejected = g.Count(a => a.Status == "rejected"),
            })
            .OrderBy(x => x.Year)
            .ToListAsync(ct);
        var byYear = byYearRaw.Select(x => new SedaYearlyCountDto(x.Year, x.Total, x.Approved, x.Pending, x.Rejected)).ToList();

        var topSchools = await query
            .GroupBy(a => a.SchoolName)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(15)
            .ToListAsync(ct);

        var byGrade = await query
            .GroupBy(a => a.NextYearGrade)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync(ct);

        var byEducationType = await query
            .GroupBy(a => a.EducationType)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync(ct);

        var totalApplications = byYear.Sum(x => x.Total);
        var totalDistinctSchools = await query.Select(a => a.SchoolName).Distinct().CountAsync(ct);
        var totalDistinctApplicants = await query.Select(a => a.Tckn).Distinct().CountAsync(ct);

        return new SedaYearlyReportDto(
            byYear,
            topSchools.Select(x => new SedaYearlyBreakdownItemDto(string.IsNullOrWhiteSpace(x.Name) ? "Belirtilmemiş" : x.Name, x.Count)).ToList(),
            byGrade.Select(x => new SedaYearlyBreakdownItemDto(string.IsNullOrWhiteSpace(x.Name) ? "Belirtilmemiş" : x.Name, x.Count)).ToList(),
            byEducationType.Select(x => new SedaYearlyBreakdownItemDto(string.IsNullOrWhiteSpace(x.Name) ? "Belirtilmemiş" : x.Name, x.Count)).ToList(),
            totalApplications,
            totalDistinctSchools,
            totalDistinctApplicants);
    }
}
