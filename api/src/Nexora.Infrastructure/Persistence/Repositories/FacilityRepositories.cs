using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class FacilityRepository(AppDbContext context) : Repository<Facility>(context), IFacilityRepository
{
    public async Task<PagedResult<Facility>> GetPagedAsync(string module, FacilityListParams p, HashSet<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.Module == module);
        if (scopedRefIds is not null)
            query = query.Where(x => scopedRefIds.Contains(x.Id));
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%") || (x.ManagerName != null && EF.Functions.ILike(x.ManagerName, $"%{s}%")));
        }
        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<Facility>> GetActiveByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.IsActive).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<List<Facility>> GetAllByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<int> NextCodeNumberAsync(string module, CancellationToken ct)
    {
        var codes = await DbSet.IgnoreQueryFilters().Where(x => x.Module == module).Select(x => x.Code).ToListAsync(ct);
        var max = 0;
        foreach (var c in codes)
        {
            var digits = new string((c ?? "").Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var n) && n > max) max = n;
        }
        return max + 1;
    }

    public async Task<(int Active, int Total)> GetCountsAsync(string module, CancellationToken ct)
    {
        var agg = await DbSet.Where(x => x.Module == module)
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Active = g.Count(x => x.IsActive) })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0) : (agg.Active, agg.Total);
    }

    public async Task<Facility?> GetByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.StaticQrCode == code, ct);

    public async Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().AnyAsync(x => x.StaticQrCode == code, ct);

    public async Task<PagedResult<Facility>> GetTrashAsync(string module, FacilityListParams p, CancellationToken ct)
    {
        var query = DbSet.IgnoreQueryFilters().Where(x => x.Module == module && x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%"));
        }
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<Facility?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public void HardRemove(Facility entity) => DbSet.Remove(entity);

    public async Task<int> GetMaxSortOrderAsync(string module, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().Where(x => x.Module == module).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? 0;

    public async Task<List<Facility>> GetAllForReorderAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module).OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt).ToListAsync(ct);

    private static IQueryable<Facility> ApplySort(IQueryable<Facility> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? q.OrderByDescending(x => x.Name) : q.OrderBy(x => x.Name),
            "capacity" => desc ? q.OrderByDescending(x => x.Capacity) : q.OrderBy(x => x.Capacity),
            "isactive" => desc ? q.OrderByDescending(x => x.IsActive) : q.OrderBy(x => x.IsActive),
            "createdat" => desc ? q.OrderByDescending(x => x.CreatedAt) : q.OrderBy(x => x.CreatedAt),
            // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak sıralaması — admin panelden
            // "Manuel" sıralama seçildiğinde bu, SortOrder'a göre (reorder endpoint'inin yazdığı
            // değer) listelenir. Varsayılan (sort parametresi verilmemiş) davranış korunur, bu
            // sadece açıkça istenince devreye girer.
            // ThenBy(CreatedAt): SortOrder=0 ile eşit değerli kayıtlar (hiç reorder edilmemiş
            // veya API dışından/SQL ile eklenmiş tarihsel veri) olduğunda Postgres'in sayfalanan
            // sorgularda kararsız/değişken sıra vermesini önler — GetAllForReorderAsync'teki
            // aynı ikincil anahtar.
            "manual" or "sortorder" => desc ? q.OrderByDescending(x => x.SortOrder).ThenByDescending(x => x.CreatedAt) : q.OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt),
            _ => q.OrderBy(x => x.Name),
        };
    }
}

public class FacilityBranchRepository(AppDbContext context) : Repository<FacilityBranch>(context), IFacilityBranchRepository
{
    public async Task<PagedResult<FacilityBranch>> GetPagedAsync(string module, FacilityBranchListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.Module == module);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%") || EF.Functions.ILike(x.Description, $"%{s}%"));
        }
        if (!string.IsNullOrWhiteSpace(p.Category))
        {
            var c = p.Category.Trim();
            query = query.Where(x => x.Category == c);
        }
        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<FacilityBranch>> GetActiveByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string module, string name, Guid? excludeId, CancellationToken ct)
    {
        var n = name.Trim();
        return await DbSet.AnyAsync(x => x.Module == module && EF.Functions.ILike(x.Name, LikeQuery.Escape(n)) && (excludeId == null || x.Id != excludeId), ct);
    }

    public async Task<PagedResult<FacilityBranch>> GetTrashAsync(string module, FacilityBranchListParams p, CancellationToken ct)
    {
        var query = DbSet.IgnoreQueryFilters().Where(x => x.Module == module && x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%") || EF.Functions.ILike(x.Description, $"%{s}%"));
        }
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<FacilityBranch?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public void HardRemove(FacilityBranch entity) => DbSet.Remove(entity);

    private static IQueryable<FacilityBranch> ApplySort(IQueryable<FacilityBranch> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? q.OrderByDescending(x => x.Name) : q.OrderBy(x => x.Name),
            "isactive" => desc ? q.OrderByDescending(x => x.IsActive) : q.OrderBy(x => x.IsActive),
            "createdat" => desc ? q.OrderByDescending(x => x.CreatedAt) : q.OrderBy(x => x.CreatedAt),
            _ => q.OrderBy(x => x.Name),
        };
    }
}

public class FacilityGroupRepository(AppDbContext context) : Repository<FacilityGroup>(context), IFacilityGroupRepository
{
    public async Task<PagedResult<FacilityGroup>> GetPagedAsync(string module, FacilityGroupListParams p, HashSet<Guid>? scopedFacilityIds, CancellationToken ct, HashSet<Guid>? scopedGroupIds = null)
    {
        var query = DbSet.Where(x => x.Module == module);
        if (scopedFacilityIds is not null)
            query = query.Where(x => scopedFacilityIds.Contains(x.FacilityId));
        if (scopedGroupIds is not null)
            query = query.Where(x => scopedGroupIds.Contains(x.Id));
        if (p.FacilityId.HasValue) query = query.Where(x => x.FacilityId == p.FacilityId.Value);
        if (p.BranchId.HasValue) query = query.Where(x => x.BranchId == p.BranchId.Value);
        if (p.ParentGroupId.HasValue) query = query.Where(x => x.ParentGroupId == p.ParentGroupId.Value);
        if (p.IsParent.HasValue)
            query = p.IsParent.Value
                ? query.Where(x => x.ParentGroupId == null)
                : query.Where(x => x.ParentGroupId != null);
        if (!string.IsNullOrWhiteSpace(p.Type)) query = query.Where(x => x.Type == p.Type);
        if (!string.IsNullOrWhiteSpace(p.Gender)) query = query.Where(x => x.Gender == p.Gender);
        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        // Kullanıcı isteği (2026-08-07): dönemi (PeriodEnd) geçmiş gruplar/seanslar varsayılan
        // olarak admin listesinden gizlenir (Travels "hidePast" ile aynı davranış). Akademi tipi
        // gibi süresiz gruplar (PeriodEnd null) veya "recurring" dönem tipindekiler hiçbir zaman
        // "geçmiş" sayılmaz — bunlar sürekli üyelik/tekrarlayan program olduğu için etkilenmez.
        if (p.HidePast == true)
        {
            var today = TurkeyTime.TodayDate();
            query = query.Where(x => x.PeriodType == "recurring" || x.PeriodEnd == null || x.PeriodEnd.Value.Date >= today);
        }
        // Kullanıcı isteği (2026-08-11): "Gezi Seferleri"ndeki başlangıç/bitiş tarih aralığı
        // filtresiyle aynı desen. Recurring/süresiz gruplar (PeriodEnd null) HidePast'teki gibi
        // hiçbir zaman bu filtreyle elenmez — aksi halde akademi tipi kalıcı gruplar tarih
        // filtresi girildiğinde listeden kaybolurdu.
        if (p.StartDate.HasValue)
        {
            var start = p.StartDate.Value.Date;
            query = query.Where(x => x.PeriodType == "recurring" || x.PeriodEnd == null || x.PeriodEnd.Value.Date >= start);
        }
        if (p.EndDate.HasValue)
        {
            var end = p.EndDate.Value.Date;
            query = query.Where(x => x.PeriodType == "recurring" || x.PeriodStart == null || x.PeriodStart.Value.Date <= end);
        }
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%"));
        }
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    private IQueryable<FacilityGroup> BuildDiscoverQuery(DiscoverFilter f)
    {
        var today = TurkeyTime.TodayDate();
        var query = DbSet.Where(x => x.Module == f.Module && x.IsActive
            && (x.PeriodType == "recurring" || x.PeriodEnd == null || x.PeriodEnd >= today)
            && Context.Set<Facility>().Any(fac => fac.Id == x.FacilityId && fac.IsActive)
            && Context.Set<FacilityBranch>().Any(branch => branch.Id == x.BranchId && branch.IsActive)
            // Kullanıcı isteği (2026-08-05): "gruplar pasif olduğunda önceki seanslar aktif olsa
            // bile grup kapalı olduğu için seans görüntülenmez, başvuru açık olmamalı — tüm
            // modüller için geçerli". Bir önceki düzeltme (7de766e) sadece branch/tesis pasifliğini
            // kapsıyordu; üst grup (parent group / "seans") pasif olduğunda alt grup ("session")
            // hâlâ aktifse discover'da görünmeye devam ediyordu (kasif modülünde canlı veriyle
            // doğrulandı — Yakup Atölye alt grubu, pasif üst seansına rağmen bookable dönüyordu).
            && (x.ParentGroupId == null
                || Context.Set<FacilityGroup>().Any(parent => parent.Id == x.ParentGroupId && parent.IsActive)));

        if (f.FacilityId.HasValue)
            query = query.Where(x => x.FacilityId == f.FacilityId.Value);

        if (f.BranchId.HasValue)
            query = query.Where(x => x.BranchId == f.BranchId.Value);

        if (!string.IsNullOrWhiteSpace(f.BranchName))
        {
            var bn = f.BranchName;
            query = query.Where(x => Context.Set<FacilityBranch>()
                .Any(b => b.Id == x.BranchId && b.Name == bn));
        }

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = LikeQuery.Escape(f.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%"));
        }

        if (f.Age.HasValue)
        {
            var age = f.Age.Value;
            query = query.Where(x => (x.AgeMin == 0 || x.AgeMin <= age) && (x.AgeMax == 0 || x.AgeMax >= age));
        }

        if (f.AgeMin.HasValue)
        {
            var min = f.AgeMin.Value;
            query = query.Where(x => x.AgeMax == 0 || x.AgeMax >= min);
        }

        if (f.AgeMax.HasValue)
        {
            var max = f.AgeMax.Value;
            query = query.Where(x => x.AgeMin == 0 || x.AgeMin <= max);
        }

        if (!string.IsNullOrWhiteSpace(f.Gender) && f.Gender != "mixed")
            query = query.Where(x => x.Gender == "mixed" || x.Gender == f.Gender);

        if (f.OnlySubGroups.HasValue)
            query = f.OnlySubGroups.Value
                ? query.Where(x => x.ParentGroupId != null)
                : query.Where(x => x.ParentGroupId == null);

        if (f.OnlyAvailable)
            query = query.Where(x => x.Capacity <= 0
                || x.RegisteredCount < x.Capacity
                || (x.ReserveCapacity > 0 && x.WaitlistCount < x.ReserveCapacity));

        // Kontenjanı dolmuş gruplar: hem asıl kontenjan hem (varsa) yedek liste dolu.
        if (f.OnlyFull)
            query = query.Where(x => x.Capacity > 0
                && x.RegisteredCount >= x.Capacity
                && (x.ReserveCapacity <= 0 || x.WaitlistCount >= x.ReserveCapacity));

        if (f.OnlyWithParking)
            query = query.Where(x => Context.Set<Facility>()
                .Any(fac => fac.Id == x.FacilityId && fac.ServiceFacilityId != null
                    && Context.Set<ServiceFacility>().Any(sf => sf.Id == fac.ServiceFacilityId && sf.ParkingCapacity > 0)));

        return query;
    }

    public async Task<PagedResult<FacilityGroup>> GetActiveDiscoverAsync(DiscoverFilter f, int page, int limit, CancellationToken ct)
    {
        var query = BuildDiscoverQuery(f).OrderBy(x => x.PeriodStart).ThenBy(x => x.Name);
        return await PaginateAsync(query, page, limit, ct);
    }

    public async Task<int> CountDiscoverAsync(DiscoverFilter f, CancellationToken ct)
        => await BuildDiscoverQuery(f).CountAsync(ct);

    public async Task<List<BranchCount>> GetActiveBranchesAsync(string module, int? eligibleAge, string? eligibleGender, CancellationToken ct)
    {
        var baseFilter = new DiscoverFilter(module, null, null, null, null, null, null, false);
        var totals = await BuildDiscoverQuery(baseFilter)
            .Join(Context.Set<FacilityBranch>().Where(b => b.IsActive), g => g.BranchId, b => b.Id, (g, b) => new { g, b.Name })
            .GroupBy(x => x.Name)
            .Select(gr => new { BranchName = gr.Key, Count = gr.Count() })
            .ToListAsync(ct);

        var eligibleFilter = baseFilter with { Age = eligibleAge, Gender = eligibleGender };
        var eligibles = await BuildDiscoverQuery(eligibleFilter)
            .Join(Context.Set<FacilityBranch>().Where(b => b.IsActive), g => g.BranchId, b => b.Id, (g, b) => new { g, b.Name })
            .GroupBy(x => x.Name)
            .Select(gr => new { BranchName = gr.Key, Count = gr.Count() })
            .ToListAsync(ct);

        var eligibleMap = eligibles.ToDictionary(x => x.BranchName, x => x.Count);
        return totals
            .OrderBy(x => x.BranchName)
            .Select(x => new BranchCount(x.BranchName, x.Count, eligibleMap.GetValueOrDefault(x.BranchName, 0)))
            .ToList();
    }

    public async Task<FacilityDiscoverFilters> GetActiveFiltersAsync(DiscoverFilter f, int? eligibleAge, string? eligibleGender, CancellationToken ct)
    {
        var scopeFilter = new DiscoverFilter(f.Module, f.Search, null, null, null, null, f.OnlySubGroups, false);
        var scope = BuildDiscoverQuery(scopeFilter);

        var facilities = await scope
            .Join(Context.Set<Facility>().Where(fac => fac.IsActive), g => g.FacilityId, fac => fac.Id, (g, fac) => new { fac.Id, fac.Name })
            .GroupBy(x => new { x.Id, x.Name })
            .Select(gr => new FacilityFilterOption(gr.Key.Id, gr.Key.Name, gr.Count()))
            .ToListAsync(ct);

        var branchRaw = await scope
            .Join(Context.Set<FacilityBranch>().Where(b => b.IsActive), g => g.BranchId, b => b.Id, (g, b) => new { b.Id, b.Name })
            .GroupBy(x => new { x.Id, x.Name })
            .Select(gr => new { gr.Key.Id, gr.Key.Name, Count = gr.Count() })
            .ToListAsync(ct);

        var genderRaw = await scope
            .GroupBy(x => x.Gender)
            .Select(gr => new { Gender = gr.Key, Count = gr.Count() })
            .ToListAsync(ct);

        var ageRaw = await scope
            .GroupBy(x => new { x.AgeMin, x.AgeMax })
            .Select(gr => new { gr.Key.AgeMin, gr.Key.AgeMax, Count = gr.Count() })
            .ToListAsync(ct);

        var availableCount = await BuildDiscoverQuery(scopeFilter with { OnlyAvailable = true }).CountAsync(ct);
        var totalCount = await scope.CountAsync(ct);
        var withParkingCount = await BuildDiscoverQuery(scopeFilter with { OnlyWithParking = true }).CountAsync(ct);

        var branches = branchRaw
            .OrderBy(x => x.Name, StringComparer.Create(new CultureInfo("tr-TR"), true))
            .Select(x => new BranchCount(x.Name, x.Count, x.Count))
            .ToList();

        var genders = genderRaw
            .Select(x => new FacilityFilterOption(Guid.Empty, x.Gender, x.Count))
            .OrderBy(x => x.Name)
            .ToList();

        var ageGroups = ageRaw
            .Where(x => x.AgeMin > 0 || x.AgeMax > 0)
            .OrderBy(x => x.AgeMin).ThenBy(x => x.AgeMax)
            .Select(x => new FacilityAgeGroupOption(x.AgeMin, x.AgeMax, x.Count))
            .ToList();

        return new FacilityDiscoverFilters(
            facilities.OrderBy(x => x.Name, StringComparer.Create(new CultureInfo("tr-TR"), true)).ToList(),
            branches, genders, ageGroups, availableCount, totalCount, withParkingCount);
    }

    public async Task<List<FacilityGroup>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.FacilityId == facilityId).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<int> CountByBranchAsync(Guid branchId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.BranchId == branchId, ct);

    public async Task<(int ActiveGroups, int Courses, int Academies)> GetGroupStatsAsync(string module, CancellationToken ct)
    {
        var agg = await DbSet.Where(x => x.Module == module && x.IsActive)
            .GroupBy(_ => 1)
            .Select(g => new { Active = g.Count(), Courses = g.Count(x => x.Type == "kurs"), Academies = g.Count(x => x.Type == "akademi") })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0, 0) : (agg.Active, agg.Courses, agg.Academies);
    }

    public async Task<Dictionary<Guid, int>> CountActiveByFacilitiesAsync(string module, List<Guid> facilityIds, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.IsActive && facilityIds.Contains(x.FacilityId))
            .GroupBy(x => x.FacilityId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<Dictionary<Guid, int>> SumActiveCapacityByFacilitiesAsync(string module, List<Guid> facilityIds, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.IsActive && facilityIds.Contains(x.FacilityId))
            .GroupBy(x => x.FacilityId)
            .Select(g => new { g.Key, Sum = g.Sum(x => x.Capacity) })
            .ToDictionaryAsync(x => x.Key, x => x.Sum, ct);

    public async Task<Dictionary<Guid, int>> CountActiveByBranchesAsync(List<Guid> branchIds, CancellationToken ct)
        => await DbSet.Where(x => x.IsActive && branchIds.Contains(x.BranchId))
            .GroupBy(x => x.BranchId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<int> CountByInstructorAsync(Guid instructorId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.InstructorId == instructorId, ct);

    public async Task<List<FacilityGroup>> GetActiveWithInstructorByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.IsActive).ToListAsync(ct);

    public async Task<List<FacilityGroup>> GetAllByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module).ToListAsync(ct);

    public async Task<List<Guid>> GetFacilityIdsByGroupIdsAsync(List<Guid> groupIds, CancellationToken ct)
        => await DbSet.Where(x => groupIds.Contains(x.Id))
            .Select(x => x.FacilityId)
            .Distinct()
            .ToListAsync(ct);

    public async Task<PagedResult<FacilityGroup>> GetTrashAsync(string module, FacilityGroupListParams p, CancellationToken ct)
    {
        var query = DbSet.IgnoreQueryFilters().Where(x => x.Module == module && x.IsDeleted);
        if (p.FacilityId.HasValue) query = query.Where(x => x.FacilityId == p.FacilityId.Value);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{s}%"));
        }
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<FacilityGroup?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<int> GetMaxSortOrderAsync(Guid facilityId, Guid? parentGroupId, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().Where(x => x.FacilityId == facilityId && x.ParentGroupId == parentGroupId)
            .Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? 0;

    public async Task<List<FacilityGroup>> GetAllForReorderAsync(Guid facilityId, Guid? parentGroupId, CancellationToken ct)
        => await DbSet.Where(x => x.FacilityId == facilityId && x.ParentGroupId == parentGroupId)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt).ToListAsync(ct);

    public void HardRemove(FacilityGroup entity) => DbSet.Remove(entity);

    private static IQueryable<FacilityGroup> ApplySort(IQueryable<FacilityGroup> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? q.OrderByDescending(x => x.Name) : q.OrderBy(x => x.Name),
            "capacity" => desc ? q.OrderByDescending(x => x.Capacity) : q.OrderBy(x => x.Capacity),
            "isactive" => desc ? q.OrderByDescending(x => x.IsActive) : q.OrderBy(x => x.IsActive),
            "createdat" => desc ? q.OrderByDescending(x => x.CreatedAt) : q.OrderBy(x => x.CreatedAt),
            "manual" or "sortorder" => desc ? q.OrderByDescending(x => x.SortOrder).ThenByDescending(x => x.CreatedAt) : q.OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt),
            _ => q.OrderBy(x => x.Name),
        };
    }
}

public class FacilitySessionRepository(AppDbContext context) : Repository<FacilitySession>(context), IFacilitySessionRepository
{
    public async Task<Dictionary<Guid, int>> CountActiveByBranchesAsync(List<Guid> branchIds, CancellationToken ct)
        => await DbSet.Where(x => !x.IsCancelled)
            .Join(Context.Set<FacilityGroup>().Where(g => branchIds.Contains(g.BranchId)), s => s.GroupId, g => g.Id, (s, g) => g.BranchId)
            .GroupBy(b => b)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<List<FacilitySession>> GetByMonthAsync(string module, Guid facilityId, int year, int month, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.FacilityId == facilityId && x.Date.Year == year && x.Date.Month == month)
            .ToListAsync(ct);

    public async Task<List<FacilitySession>> GetByDayAsync(string module, Guid facilityId, DateTime date, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.FacilityId == facilityId && x.Date == date.Date)
            .OrderBy(x => x.StartTime).ToListAsync(ct);

    public async Task<List<FacilitySession>> GetByGroupAsync(Guid groupId, CancellationToken ct)
        => await DbSet.Where(x => x.GroupId == groupId).OrderBy(x => x.Date).ToListAsync(ct);

    public async Task<List<DateTime>> GetDistinctDatesByGroupAsync(Guid groupId, CancellationToken ct)
        => await DbSet.Where(x => x.GroupId == groupId && !x.IsCancelled).Select(x => x.Date).Distinct().ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> CountActiveByGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return [];
        return await DbSet
            .Where(x => groupIds.Contains(x.GroupId) && !x.IsCancelled)
            .GroupBy(x => x.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);
    }
}

public class FacilityApplicationRepository(AppDbContext context) : Repository<FacilityApplication>(context), IFacilityApplicationRepository
{
    public async Task<Dictionary<Guid, int>> CountByBranchesAsync(List<Guid> branchIds, CancellationToken ct)
        => await DbSet.Where(x => branchIds.Contains(x.BranchId))
            .GroupBy(x => x.BranchId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<PagedResult<FacilityApplication>> GetPagedAsync(string module, FacilityApplicationListParams p, HashSet<Guid>? scopedFacilityIds, CancellationToken ct, HashSet<Guid>? scopedGroupIds = null)
    {
        var query = DbSet.Where(x => x.Module == module);
        if (scopedFacilityIds is not null)
            query = query.Where(x => scopedFacilityIds.Contains(x.FacilityId));
        if (scopedGroupIds is not null)
            query = query.Where(x => x.GroupId != null && scopedGroupIds.Contains(x.GroupId.Value));
        if (p.FacilityId.HasValue) query = query.Where(x => x.FacilityId == p.FacilityId.Value);
        if (p.BranchId.HasValue) query = query.Where(x => x.BranchId == p.BranchId.Value);
        if (p.GroupId.HasValue) query = query.Where(x => x.GroupId == p.GroupId.Value);
        if (!string.IsNullOrWhiteSpace(p.Status)) query = query.Where(x => x.Status == p.Status);
        if (p.Date.HasValue) query = query.Where(x => x.AppliedAt.Date == p.Date.Value.Date);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = p.Search;
            var searchTerm = LikeQuery.Escape(s);
            query = query.Where(x => EF.Functions.ILike(x.FullName, $"%{searchTerm}%") || x.Tckn.Contains(s) || x.Phone.Contains(s));
        }
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<PagedResult<FacilityApplication>> GetByParticipantsAsync(IReadOnlyCollection<Guid> participantIds, string? module, string? status, int page, int limit, CancellationToken ct, string? search = null, IReadOnlyCollection<string>? tckns = null)
    {
        if (participantIds.Count == 0 && (tckns is null || tckns.Count == 0))
            return new PagedResult<FacilityApplication> { Items = [], Total = 0, Page = page, Limit = limit };

        var ids = participantIds.ToList();
        // Hata raporu (docs/hata.md #5/#7/#8): mükerrer/çakışma kontrolü kişiyi TCKN ile tanırken
        // bu liste yalnızca ParticipantId'ye bakıyordu. Vatandaş adına TCKN ile açılmış (ör. admin
        // panelden ya da eski aktarımdan gelen, ParticipantId'si boş) bir başvuru yeni başvuruyu
        // engelliyor ama "Başvurularım" ekranında hiç görünmüyordu. İki taraf artık aynı kişiyi
        // aynı iki anahtarla (ParticipantId VEYA TCKN) tanıyor.
        var tcknList = tckns?.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList() ?? [];
        var query = DbSet.Where(a =>
            (a.ParticipantId != null && ids.Contains(a.ParticipantId.Value))
            || (tcknList.Count > 0 && tcknList.Contains(a.Tckn)));

        if (!string.IsNullOrWhiteSpace(module))
            query = query.Where(a => a.Module == module);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(a => a.Status == status);

        // Kullanıcı isteği (2026-09-23): mobil genel arama ekranı, giriş yapmış kullanıcının
        // kendi tesis/program başvurularını grup (ders/seans) veya branş adı üzerinden de
        // eşleştirebilsin diye eklendi.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            var matchingGroupIds = Context.Set<FacilityGroup>()
                .Where(g => EF.Functions.ILike(g.Name, $"%{term}%"))
                .Select(g => g.Id);
            var matchingBranchIds = Context.Set<FacilityBranch>()
                .Where(b => EF.Functions.ILike(b.Name, $"%{term}%"))
                .Select(b => b.Id);
            query = query.Where(a =>
                (a.GroupId != null && matchingGroupIds.Contains(a.GroupId.Value))
                || matchingBranchIds.Contains(a.BranchId));
        }

        var todayUtc = TurkeyTime.TodayDate();
        var ordered = query
            .OrderBy(a => (Context.Set<FacilityGroup>()
                .Where(g => a.GroupId != null && g.Id == a.GroupId)
                .Select(g => g.PeriodEnd)
                .FirstOrDefault() ?? DateTime.MaxValue) >= todayUtc ? 0 : 1)
            .ThenBy(a => Context.Set<FacilityGroup>()
                .Where(g => a.GroupId != null && g.Id == a.GroupId)
                .Select(g => g.PeriodStart)
                .FirstOrDefault() ?? DateTime.MaxValue)
            .ThenByDescending(a => a.AppliedAt);

        return await PaginateAsync(ordered, page, limit, ct);
    }

    public async Task<(int Total, int Pending, int Approved, int Rejected)> GetStatusCountsAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var baseQuery = DbSet.Where(x => x.Module == module && x.FacilityId == facilityId);
        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Pending = g.Count(x => x.Status == "pending"), Approved = g.Count(x => x.Status == "approved"), Rejected = g.Count(x => x.Status == "rejected") })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0, 0, 0) : (agg.Total, agg.Pending, agg.Approved, agg.Rejected);
    }

    public async Task<List<Guid>> GetParticipantIdsByApplicationIdsAsync(IReadOnlyCollection<Guid> applicationIds, CancellationToken ct)
    {
        if (applicationIds.Count == 0) return [];
        return await DbSet
            .Where(a => applicationIds.Contains(a.Id) && a.ParticipantId != null)
            .Select(a => a.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
    }

    private static IQueryable<FacilityApplication> ApplySort(IQueryable<FacilityApplication> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "fullname" => desc ? q.OrderByDescending(x => x.FullName) : q.OrderBy(x => x.FullName),
            "appliedat" => desc ? q.OrderByDescending(x => x.AppliedAt) : q.OrderBy(x => x.AppliedAt),
            "status" => desc ? q.OrderByDescending(x => x.Status) : q.OrderBy(x => x.Status),
            _ => q.OrderByDescending(x => x.AppliedAt),
        };
    }
}

public class FacilityRegistrationRepository(AppDbContext context) : Repository<FacilityRegistration>(context), IFacilityRegistrationRepository
{
    public async Task<List<FacilityRegistration>> GetByGroupAsync(Guid groupId, CancellationToken ct)
        => await DbSet.Where(x => x.GroupId == groupId && x.Status == "active")
            .OrderBy(x => x.Kind).ThenBy(x => x.WaitlistOrder).ThenBy(x => x.FullName).ToListAsync(ct);

    public async Task<List<FacilityRegistration>> GetWaitlistByGroupAsync(Guid groupId, CancellationToken ct)
        => await DbSet.Where(x => x.GroupId == groupId && x.Status == "active" && x.Kind == "reserve")
            .OrderBy(x => x.WaitlistOrder).ToListAsync(ct);

    public async Task<List<FacilityRegistration>> GetActiveMainByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.Where(x => x.Tckn == tckn && x.Status == "active" && x.Kind == "main").ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> CountActiveWaitlistByGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return new();
        return await DbSet
            .Where(r => groupIds.Contains(r.GroupId) && r.Status == "active" && r.Kind == "reserve")
            .GroupBy(r => r.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.GroupId, g => g.Count, ct);
    }

    public async Task<(int Main, int Waitlist)> GetCountsByGroupAsync(Guid groupId, CancellationToken ct)
    {
        var agg = await DbSet.Where(x => x.GroupId == groupId && x.Status == "active")
            .GroupBy(_ => 1)
            .Select(g => new { Main = g.Count(x => x.Kind == "main"), Waitlist = g.Count(x => x.Kind == "reserve") })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0) : (agg.Main, agg.Waitlist);
    }

    public async Task<(int MainParticipants, int WaitlistParticipants)> GetModuleParticipantCountsAsync(string module, CancellationToken ct)
    {
        var agg = await DbSet.Where(x => x.Module == module && x.Status == "active")
            .GroupBy(_ => 1)
            .Select(g => new { Main = g.Count(x => x.Kind == "main"), Waitlist = g.Count(x => x.Kind == "reserve") })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0) : (agg.Main, agg.Waitlist);
    }

    // Kullanıcı bulgusu (doluluk oranı %825 gibi anlamsız değerler gösteriyordu): bu sorgu, kaydın
    // bağlı olduğu grubun hâlâ AKTİF olup olmadığına bakmadan sadece kaydın kendi Status='active'
    // alanına bakıyordu. Bir grup pasife alındığında (ToggleStatusAsync) o gruptaki kayıtlar
    // silinmiyor/removed edilmiyor — kayıt kendi başına "aktif" kalmaya devam ediyor. Doluluk oranı
    // hesaplayan kod (SumActiveCapacityByFacilitiesAsync, FacilityDashboardOverview.rateOf,
    // FacilityOverviewCard) paydada YALNIZCA aktif grupların kapasitesini topluyor, ama pay
    // (registeredCount) pasif gruplardaki kayıtları da içeriyordu — küçülen payda + değişmeyen pay
    // = anlamsız yüksek yüzdeler (%825, %640 vb.). Artık yalnızca hâlâ aktif bir gruba bağlı
    // kayıtlar sayılıyor, tıpkı kapasite tarafındaki filtreyle tutarlı olacak şekilde.
    public async Task<Dictionary<Guid, int>> CountActiveByFacilitiesAsync(List<Guid> facilityIds, string kind, CancellationToken ct)
        => await DbSet
            .Where(x => x.Status == "active" && x.Kind == kind && facilityIds.Contains(x.FacilityId))
            .Join(Context.Set<FacilityGroup>().Where(g => g.IsActive), x => x.GroupId, g => g.Id, (x, g) => x)
            .GroupBy(x => x.FacilityId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<List<FacilityRegistration>> GetPeriodExpiredActiveAsync(DateTime today, CancellationToken ct)
        => await DbSet.Where(x => x.Status == "active" && x.PeriodEnd != null && x.PeriodEnd < today).ToListAsync(ct);

    public async Task<HashSet<Guid>> GetParticipantIdsByGroupsAsync(List<Guid> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return [];
        var ids = await DbSet
            .Where(x => groupIds.Contains(x.GroupId) && x.Status == "active" && x.ParticipantId != null)
            .Select(x => x.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
        return [.. ids];
    }

    public async Task<HashSet<Guid>> GetParticipantIdsByFacilitiesAsync(List<Guid> facilityIds, CancellationToken ct)
    {
        if (facilityIds.Count == 0) return [];
        var ids = await DbSet
            .Where(x => facilityIds.Contains(x.FacilityId) && x.Status == "active" && x.ParticipantId != null)
            .Select(x => x.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
        return [.. ids];
    }

    public async Task<HashSet<Guid>> GetParticipantIdsByRegistrationIdsAsync(List<Guid> registrationIds, CancellationToken ct)
    {
        if (registrationIds.Count == 0) return [];
        var ids = await DbSet
            .Where(x => registrationIds.Contains(x.Id) && x.ParticipantId != null)
            .Select(x => x.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
        return [.. ids];
    }
}

public class FacilityAttendanceRepository(AppDbContext context) : Repository<FacilityAttendance>(context), IFacilityAttendanceRepository
{
    public async Task<List<FacilityAttendance>> GetBySessionAsync(Guid sessionId, CancellationToken ct)
        => await DbSet.Where(x => x.SessionId == sessionId).ToListAsync(ct);

    public async Task<List<FacilityAttendance>> GetByRegistrationAsync(Guid registrationId, CancellationToken ct)
        => await DbSet.Where(x => x.RegistrationId == registrationId).ToListAsync(ct);

    public async Task<List<GroupAttendanceStat>> GetGroupAttendanceStatsAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module)
            .GroupBy(x => x.GroupId)
            .Select(g => new GroupAttendanceStat(g.Key, g.Count(a => a.Status == "present" || a.Status == "late"), g.Count()))
            .ToListAsync(ct);

    public async Task<Dictionary<Guid, DateTime>> GetMostRecentPresentMarkedAtByFacilityAsync(string module, CancellationToken ct)
        => await DbSet
            .Where(x => x.Module == module && (x.Status == "present" || x.Status == "late"))
            .GroupBy(x => x.FacilityId)
            .Select(g => new { FacilityId = g.Key, LastMarkedAt = g.Max(a => a.MarkedAt) })
            .ToDictionaryAsync(x => x.FacilityId, x => x.LastMarkedAt, ct);
}

public class FacilityDeviceRepository(AppDbContext context) : Repository<FacilityDevice>(context), IFacilityDeviceRepository
{
    public async Task<List<FacilityDevice>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.FacilityId == facilityId).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<List<FacilityDevice>> GetByServiceFacilityAsync(string module, Guid serviceFacilityId, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.ServiceFacilityId == serviceFacilityId)
            .OrderBy(x => x.Scope).ThenBy(x => x.Name).ToListAsync(ct);

    public async Task<List<FacilityDevice>> GetByHallAsync(Guid hallId, CancellationToken ct)
        => await DbSet.Where(x => x.Scope == "event" && x.HallId == hallId)
            .OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<bool> ExistsByCodeAsync(string code, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().AnyAsync(x => x.DeviceCode == code, ct);

    public async Task<bool> ExistsBySerialNoAsync(string serialNo, Guid? excludeId, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.SerialNo == serialNo && (excludeId == null || x.Id != excludeId), ct);
}

public class FacilityMasterAccessLogRepository(AppDbContext context) : Repository<FacilityMasterAccessLog>(context), IFacilityMasterAccessLogRepository
{
    public async Task<List<FacilityMasterAccessLog>> GetRecentAsync(Guid serviceFacilityId, int take, CancellationToken ct)
        => await DbSet.Where(l => l.ServiceFacilityId == serviceFacilityId)
            .OrderByDescending(l => l.At).Take(take).ToListAsync(ct);
}

public class FacilitySettingsRepository(AppDbContext context) : Repository<FacilitySettingsRecord>(context), IFacilitySettingsRepository
{
    public async Task<FacilitySettingsRecord?> GetGeneralAsync(string module, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Module == module && x.Scope == "general", ct);

    public async Task<FacilitySettingsRecord?> GetForFacilityAsync(Guid facilityId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Scope == "facility" && x.FacilityId == facilityId, ct);
}

public class FacilityInstructorRepository(AppDbContext context) : Repository<FacilityInstructor>(context), IFacilityInstructorRepository
{
    public async Task<PagedResult<FacilityInstructor>> GetPagedAsync(string module, FacilityInstructorListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.Module == module);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.FullName, $"%{s}%") || (x.Specialty != null && EF.Functions.ILike(x.Specialty, $"%{s}%")));
        }
        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        return await PaginateAsync(ApplySort(query, p.Sort, p.Order), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<FacilityInstructor>> GetActiveByModuleAsync(string module, CancellationToken ct)
        => await DbSet.Where(x => x.Module == module && x.IsActive).OrderBy(x => x.FullName).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string module, string fullName, Guid? excludeId, CancellationToken ct)
    {
        var n = fullName.Trim();
        return await DbSet.AnyAsync(x => x.Module == module && EF.Functions.ILike(x.FullName, LikeQuery.Escape(n)) && (excludeId == null || x.Id != excludeId), ct);
    }

    private static IQueryable<FacilityInstructor> ApplySort(IQueryable<FacilityInstructor> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "fullname" => desc ? q.OrderByDescending(x => x.FullName) : q.OrderBy(x => x.FullName),
            "isactive" => desc ? q.OrderByDescending(x => x.IsActive) : q.OrderBy(x => x.IsActive),
            "createdat" => desc ? q.OrderByDescending(x => x.CreatedAt) : q.OrderBy(x => x.CreatedAt),
            _ => q.OrderBy(x => x.FullName),
        };
    }
}
