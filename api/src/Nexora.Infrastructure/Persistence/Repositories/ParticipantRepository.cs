using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Reports;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ParticipantRepository(AppDbContext context)
    : Repository<Participant>(context), IParticipantRepository
{
    private readonly AppDbContext _context = context;

    public async Task<PagedResult<Participant>> GetPagedAsync(ParticipantListParams p, IReadOnlyCollection<Guid>? scopedParticipantIds, CancellationToken ct)
    {
        var deleted = string.Equals(p.Status, "Deleted", StringComparison.OrdinalIgnoreCase);

        var query = deleted
            ? DbSet.IgnoreQueryFilters().Where(x => x.IsDeleted)
            : DbSet.AsQueryable();

        if (scopedParticipantIds is not null)
            query = query.Where(x => scopedParticipantIds.Contains(x.Id));

        if (!deleted && Enum.TryParse<ParticipantStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);

        query = ApplyFilters(query, p);
        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<ParticipantSummaryDto> GetSummaryAsync(ParticipantListParams p, IReadOnlyCollection<Guid>? scopedParticipantIds, CancellationToken ct)
    {
        var live = ApplyFilters(DbSet.AsQueryable(), p);
        if (scopedParticipantIds is not null)
            live = live.Where(x => scopedParticipantIds.Contains(x.Id));

        var liveAgg = await live
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.Status == ParticipantStatus.Active),
                Passive = g.Count(x => x.Status == ParticipantStatus.Passive),
                Blocked = g.Count(x => x.Status == ParticipantStatus.Blocked),
            })
            .FirstOrDefaultAsync(ct);
        var total = liveAgg?.Total ?? 0;
        var active = liveAgg?.Active ?? 0;
        var passive = liveAgg?.Passive ?? 0;
        var blocked = liveAgg?.Blocked ?? 0;

        var deletedQuery = ApplyFilters(DbSet.IgnoreQueryFilters().Where(x => x.IsDeleted), p);
        if (scopedParticipantIds is not null)
            deletedQuery = deletedQuery.Where(x => scopedParticipantIds.Contains(x.Id));
        var deleted = await deletedQuery.CountAsync(ct);

        return new ParticipantSummaryDto(total, active, passive, blocked, deleted);
    }

    public async Task<Participant?> GetByIdWithRelationsAsync(Guid id, CancellationToken ct)
        => await DbSet
            .Include(p => p.Children).ThenInclude(g => g.Child)
            .Include(p => p.Guardians).ThenInclude(g => g.Guardian)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<bool> ExistsByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.Tckn == tckn, ct);

    public async Task<Participant?> GetByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Tckn == tckn, ct);

    // APK test BUG-001 (2026-09-25): Tckn unique index'i yalnızca silinmemiş kayıtlarda
    // geçerli, yani aynı TCKN için bir silinmiş + bir aktif kayıt birlikte bulunabiliyor
    // (ör. silinen kişi sonra başka bir velinin kaydında çocuk olarak yeniden oluşturulursa).
    // Sırasız FirstOrDefault silinmiş kaydı seçtiğinde kayıt akışı onu reaktive etmeye
    // çalışıp unique index'e çarpıyor (500, "Beklenmedik bir hata"), aktif kayıtla ise
    // giriş yapılabiliyordu. Aktif kayıt her zaman önce döner.
    public async Task<Participant?> GetByTcknIncludingDeletedAsync(string tckn, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().Include(x => x.Children)
            .Where(x => x.Tckn == tckn)
            .OrderBy(x => x.IsDeleted).ThenByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<Participant?> GetByPhoneAsync(string phone, CancellationToken ct)
    {
        var normalized = phone.Trim();
        // SORUN (2026-09-23, QA madde 5 — kanıtlanmış canlı bug): "Phone" alanında
        // benzersizlik (unique) kısıtı hiç olmadığı için canlı veritabanında aynı
        // telefona sahip birden çok Participant kaydı var (ör. 00537242667 için 6 kayıt,
        // doğrulanmış canlı sorgu). Sıralamasız FirstOrDefaultAsync, login/forgot-password/
        // verify-otp/reset-password çağrıları arasında FARKLI bir kayıt döndürebiliyordu —
        // bir kullanıcının şifresini sıfırlarken aslında başka bir hesabın şifresi
        // değişiyor ya da doğrulama farklı bir hesaba karşı yapılıyor olabiliyordu.
        // Kalıcı çözüm (Phone'u unique yapmak) mevcut duplicate kayıtları insan kararıyla
        // birleştirmeyi gerektirir; o yapılana kadar en azından seçim DETERMİNİSTİK olsun:
        // aktif hesaplar pasif/engellilerden önce, aynı durumda en son güncellenen (en
        // güncel/güvenilir) kayıt tercih edilir — çağrılar arasında rastgele hesap
        // değişimi engellenir.
        return await DbSet
            .Where(x => x.Phone == normalized)
            .OrderBy(x => x.Status == Nexora.Domain.Enums.ParticipantStatus.Active ? 0 : 1)
            .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    // F02: telefonla giriş/kurtarmada belirsizliği tespit etmek için aday biçimlere uyan
    // (silinmemiş) kayıt SAYISI döndürülür; çağıran birden fazla eşleşmede hiçbir hesabı
    // seçmeden TCKN ister.
    public async Task<int> CountByPhoneCandidatesAsync(IReadOnlyCollection<string> candidates, CancellationToken ct)
        => await DbSet.CountAsync(x => x.Phone != null && candidates.Contains(x.Phone), ct);

    public async Task<List<Participant>> GetChildrenAsync(Guid guardianId, CancellationToken ct)
        => await DbSet
            .Where(c => _context.Set<ParticipantGuardian>().Any(g => g.GuardianId == guardianId && g.ChildId == c.Id))
            .ToListAsync(ct);

    public async Task<List<ParticipantGuardian>> GetGuardianLinksAsync(Guid childId, CancellationToken ct)
        => await _context.Set<ParticipantGuardian>()
            .Include(g => g.Guardian)
            .Where(g => g.ChildId == childId)
            .ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> CountChildrenForAsync(IReadOnlyList<Guid> guardianIds, CancellationToken ct)
        => await _context.Set<ParticipantGuardian>()
            .Where(g => guardianIds.Contains(g.GuardianId))
            .GroupBy(g => g.GuardianId)
            .Select(grp => new { Id = grp.Key, Count = grp.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

    public async Task<Dictionary<Guid, int>> CountGuardiansForAsync(IReadOnlyList<Guid> childIds, CancellationToken ct)
        => await _context.Set<ParticipantGuardian>()
            .Where(g => childIds.Contains(g.ChildId))
            .GroupBy(g => g.ChildId)
            .Select(grp => new { Id = grp.Key, Count = grp.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

    public async Task<Dictionary<Guid, int>> CountActivitiesForAsync(IReadOnlyDictionary<Guid, string> participantIdsWithTckn, CancellationToken ct)
    {
        if (participantIdsWithTckn.Count == 0) return [];

        var ids = participantIdsWithTckn.Keys.ToList();
        var tcknToId = participantIdsWithTckn
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
            .GroupBy(kv => kv.Value)
            .ToDictionary(g => g.Key, g => g.First().Key);
        var tckns = tcknToId.Keys.ToList();

        var byParticipantId = await _context.Set<ParticipantActivityRecord>().AsNoTracking()
            .Where(x => x.ParticipantId != null && ids.Contains(x.ParticipantId.Value))
            .GroupBy(x => x.ParticipantId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        var byTckn = tckns.Count == 0
            ? []
            : await _context.Set<ParticipantActivityRecord>().AsNoTracking()
                .Where(x => x.ParticipantId == null && x.Tckn != null && tckns.Contains(x.Tckn))
                .GroupBy(x => x.Tckn!)
                .Select(g => new { Tckn = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Tckn, x => x.Count, ct);

        var result = new Dictionary<Guid, int>(byParticipantId);
        foreach (var (tckn, count) in byTckn)
        {
            if (!tcknToId.TryGetValue(tckn, out var pid)) continue;
            result[pid] = result.GetValueOrDefault(pid) + count;
        }
        return result;
    }

    private IQueryable<Participant> ApplyFilters(IQueryable<Participant> query, ParticipantListParams p)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.FullName, $"%{term}%") ||
                x.Tckn.Contains(term) ||
                (x.Phone != null && x.Phone.Contains(term)) ||
                (x.Email != null && EF.Functions.ILike(x.Email, $"%{term}%")) ||
                (x.GuardianPhone != null && x.GuardianPhone.Contains(term)));
        }

        if (Enum.TryParse<Gender>(p.Gender, out var gender))
            query = query.Where(x => x.Gender == gender);

        if (p.Verified.HasValue)
            query = query.Where(x => x.IsVerified == p.Verified.Value);

        if (p.NviSynced.HasValue)
            query = p.NviSynced.Value
                ? query.Where(x => x.LastNviSyncAt != null)
                : query.Where(x => x.LastNviSyncAt == null);

        if (p.StartDate.HasValue)
        {
            var start = DateTime.SpecifyKind(p.StartDate.Value.Date, DateTimeKind.Utc);
            query = query.Where(x => x.RegisteredAt >= start);
        }

        if (p.EndDate.HasValue)
        {
            var end = DateTime.SpecifyKind(p.EndDate.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(x => x.RegisteredAt < end);
        }

        if (p.GuardianId.HasValue)
        {
            var gid = p.GuardianId.Value;
            query = query.Where(c => _context.Set<ParticipantGuardian>().Any(g => g.GuardianId == gid && g.ChildId == c.Id));
        }

        if (!string.IsNullOrWhiteSpace(p.MissingInfo))
        {
            query = p.MissingInfo.ToLowerInvariant() switch
            {
                "any"   => query.Where(x => x.Phone == null || x.Phone == "" || x.Tckn == null || x.Tckn == ""),
                "phone" => query.Where(x => x.Phone == null || x.Phone == ""),
                "tckn"  => query.Where(x => x.Tckn == null || x.Tckn == ""),
                "both"  => query.Where(x => (x.Phone == null || x.Phone == "") && (x.Tckn == null || x.Tckn == "")),
                _       => query
            };
        }
        else
        {
            if (p.HasPhone.HasValue)
                query = p.HasPhone.Value
                    ? query.Where(x => x.Phone != null && x.Phone != "")
                    : query.Where(x => x.Phone == null || x.Phone == "");

            if (p.HasTckn.HasValue)
                query = p.HasTckn.Value
                    ? query.Where(x => x.Tckn != null && x.Tckn != "")
                    : query.Where(x => x.Tckn == null || x.Tckn == "");
        }

        return query;
    }

    private static IQueryable<Participant> ApplySort(IQueryable<Participant> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "fullname"     => desc ? query.OrderByDescending(x => x.FullName)     : query.OrderBy(x => x.FullName),
            "tckn"         => desc ? query.OrderByDescending(x => x.Tckn)         : query.OrderBy(x => x.Tckn),
            "age"          => desc ? query.OrderBy(x => x.BirthDate)              : query.OrderByDescending(x => x.BirthDate),
            "status"       => desc ? query.OrderByDescending(x => x.Status)       : query.OrderBy(x => x.Status),
            "registeredat" => desc ? query.OrderByDescending(x => x.RegisteredAt) : query.OrderBy(x => x.RegisteredAt),
            "createdat"    => desc ? query.OrderByDescending(x => x.CreatedAt)    : query.OrderBy(x => x.CreatedAt),
            _              => query.OrderByDescending(x => x.RegisteredAt),
        };
    }
}
