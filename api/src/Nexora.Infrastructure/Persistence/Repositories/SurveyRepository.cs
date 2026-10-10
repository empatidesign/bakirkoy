using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SurveyRepository(AppDbContext context) : Repository<Survey>(context), ISurveyRepository
{
    public async Task<PagedResult<Survey>> GetPagedAsync(SurveyListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(s => EF.Functions.ILike(s.Title, $"%{term}%") || EF.Functions.ILike(s.Description, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(s => s.Status == p.Status);

        if (!string.IsNullOrWhiteSpace(p.Category))
            query = query.Where(s => s.Category == p.Category);

        if (p.IsActive.HasValue)
            query = query.Where(s => s.IsActive == p.IsActive.Value);

        if (p.ActiveWindowOnly == true)
        {
            // Bkz. QuizRepository'deki aynı düzeltme: EndDate DB'de UTC saklanıyor,
            // TR yerel saatiyle (UTC+3) karşılaştırmak aralığı 3 saat erken kapatıyordu.
            var nowUtc = DateTime.UtcNow;
            query = query.Where(s => s.EndDate == null || s.EndDate >= nowUtc);
        }

        if (!string.IsNullOrWhiteSpace(p.SurveyType))
            query = query.Where(s => s.SurveyType == p.SurveyType);

        if (!string.IsNullOrWhiteSpace(p.Topic))
            query = query.Where(s => s.Topic == p.Topic);

        if (!string.IsNullOrWhiteSpace(p.Neighborhood))
            query = query.Where(s => s.TargetNeighborhoods.Count == 0 || s.TargetNeighborhoods.Contains(p.Neighborhood));

        if (p.FieldEnabled.HasValue)
            query = query.Where(s => s.FieldEnabled == p.FieldEnabled.Value);

        // Kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yalnızca kendi oluşturduğu
        // anketleri görebiliyorsa (SurveyOwnSurveysOnly) bu filtre uygulanır.
        if (!string.IsNullOrWhiteSpace(p.CreatedByFilter))
            query = query.Where(s => s.CreatedBy == p.CreatedByFilter);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<Survey> ApplySort(IQueryable<Survey> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "title"          => desc ? query.OrderByDescending(s => s.Title)          : query.OrderBy(s => s.Title),
            "status"         => desc ? query.OrderByDescending(s => s.Status)         : query.OrderBy(s => s.Status),
            "totalresponses" => desc ? query.OrderByDescending(s => s.TotalResponses) : query.OrderBy(s => s.TotalResponses),
            "isactive"       => desc ? query.OrderByDescending(s => s.IsActive)       : query.OrderBy(s => s.IsActive),
            "createdat"      => desc ? query.OrderByDescending(s => s.CreatedAt)      : query.OrderBy(s => s.CreatedAt),
            // Kullanıcı isteği/gerçek bulgu (2026-08-12): ParticipationSurveyGenerationJob artık
            // her katılım için otomatik SourceType-bağlı anket üretiyor (Event/Travel/Facility/
            // Library) — bu, zamanla düzinelerce anket biriktirip genel/isteğe bağlı anketleri
            // (ör. "Sultangazi Belediyesi Anket Soruları", SourceType=null) vatandaş listesinde
            // (citizen-portal SurveyListTab tek sayfa limit=50 çekiyor, sayfalama yok) geriye
            // itip pratikte hiç görünmez hale getiriyordu. Yalnızca ParticipantSurveyService.
            // GetListAsync bu sıralamayı kullanır (admin panel sıralaması ETKİLENMEZ) — genel
            // anketler (SourceType null) her zaman önce, sonra en yeni tarihliler gelir.
            "citizen_priority" => desc
                ? query.OrderBy(s => s.SourceType != null).ThenByDescending(s => s.CreatedAt)
                : query.OrderBy(s => s.SourceType != null).ThenBy(s => s.CreatedAt),
            _                => query.OrderByDescending(s => s.CreatedAt),
        };
    }

    public async Task<List<SurveyQuestion>> GetQuestionsAsync(Guid surveyId, CancellationToken ct)
        => await Context.Set<SurveyQuestion>().Where(q => q.SurveyId == surveyId).OrderBy(q => q.Order).ToListAsync(ct);

    public async Task ReplaceQuestionsAsync(Guid surveyId, IEnumerable<SurveyQuestion> questions, CancellationToken ct)
    {
        var existing = await Context.Set<SurveyQuestion>().IgnoreQueryFilters().Where(q => q.SurveyId == surveyId).ToListAsync(ct);
        Context.Set<SurveyQuestion>().RemoveRange(existing);
        await Context.Set<SurveyQuestion>().AddRangeAsync(questions, ct);
    }

    public async Task<(int Total, int Active, int Passive, int Draft, int Completed)> GetSummaryCountsAsync(CancellationToken ct)
    {
        var agg = await DbSet
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(s => s.IsActive),
                Draft = g.Count(s => s.Status == "draft"),
                Completed = g.Count(s => s.Status == "completed"),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0, 0)
            : (agg.Total, agg.Active, agg.Total - agg.Active, agg.Draft, agg.Completed);
    }

    public async Task<int> GetTotalResponsesAsync(CancellationToken ct)
        // UYE-ANK-001: Survey.TotalResponses denormalize sayacı, seed/toplu ekleme akışlarında
        // (ör. çok yanıtlı demo anketler doğrudan SQL ile eklendiğinde) IncrementResponses() hiç
        // çağrılmadığı için gerçek SurveyResponses tablosuyla senkron değildi (bir ankette gerçek
        // 550 yanıt varken sayaç 17 gösteriyordu). Artık gerçek satır sayısı okunuyor.
        => await Context.Set<SurveyResponse>().CountAsync(ct);

    public async Task<Dictionary<Guid, int>> GetResponseCountsAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct)
    {
        if (surveyIds.Count == 0) return [];
        return await Context.Set<SurveyResponse>()
            .Where(r => surveyIds.Contains(r.SurveyId))
            .GroupBy(r => r.SurveyId)
            .Select(g => new { SurveyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SurveyId, x => x.Count, ct);
    }

    public async Task<List<SurveyCategoryCountDto>> GetCategoryDistributionAsync(CancellationToken ct)
    {
        var rows = await DbSet
            .Where(s => s.Category != "")
            .GroupBy(s => s.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return rows
            .OrderByDescending(x => x.Count)
            .Select(x => new SurveyCategoryCountDto(x.Category, x.Count))
            .ToList();
    }

    public async Task<List<Survey>> GetRecentAsync(int take, CancellationToken ct)
        => await DbSet.OrderByDescending(s => s.CreatedAt).Take(take).ToListAsync(ct);

    public async Task<bool> ResponseExistsAsync(Guid surveyId, string tc, CancellationToken ct)
        => await Context.Set<SurveyResponse>().AnyAsync(r => r.SurveyId == surveyId && r.CitizenTc == tc, ct);

    public async Task<HashSet<Guid>> GetRespondedSurveyIdsAsync(IReadOnlyCollection<Guid> surveyIds, string tc, CancellationToken ct)
    {
        if (surveyIds.Count == 0) return [];
        var ids = await Context.Set<SurveyResponse>()
            .Where(r => surveyIds.Contains(r.SurveyId) && r.CitizenTc == tc)
            .Select(r => r.SurveyId)
            .Distinct()
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    public async Task AddResponseAsync(SurveyResponse response, CancellationToken ct)
        => await Context.Set<SurveyResponse>().AddAsync(response, ct);

    public Task<int> CountResponsesAsync(Guid surveyId, CancellationToken ct)
        => Context.Set<SurveyResponse>().CountAsync(r => r.SurveyId == surveyId, ct);

    public Task<int> CountResponsesByParticipantsAsync(IReadOnlyCollection<Guid> participantIds, CancellationToken ct)
        => participantIds.Count == 0
            ? Task.FromResult(0)
            : Context.Set<SurveyResponse>().CountAsync(r => r.ParticipantId != null && participantIds.Contains(r.ParticipantId.Value), ct);

    public async Task<List<Guid>> GetParticipantIdsBySurveysAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct)
    {
        if (surveyIds.Count == 0) return [];
        return await Context.Set<SurveyResponse>()
            .Where(r => surveyIds.Contains(r.SurveyId) && r.ParticipantId != null)
            .Select(r => r.ParticipantId!.Value)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<SurveyResponse>> GetResponsesBySurveyIdsAsync(IReadOnlyCollection<Guid> surveyIds, CancellationToken ct)
        => surveyIds.Count == 0 ? [] : await Context.Set<SurveyResponse>().Where(r => surveyIds.Contains(r.SurveyId)).ToListAsync(ct);

    public async Task<(List<SurveyResponse> Items, int Total)> GetResponsesPagedAsync(Guid surveyId, int page, int limit, CancellationToken ct)
    {
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 100);

        var query = Context.Set<SurveyResponse>()
            .Where(r => r.SurveyId == surveyId)
            .OrderByDescending(r => r.SubmittedAt);

        var total = await query.CountAsync(ct);
        var items = await query
            .AsNoTracking()
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<SurveyResponse?> GetResponseByIdAsync(Guid surveyId, Guid responseId, CancellationToken ct)
        => Context.Set<SurveyResponse>().AsNoTracking().FirstOrDefaultAsync(r => r.SurveyId == surveyId && r.Id == responseId, ct);

    public async Task<List<SurveyResponse>> GetAllResponsesAsync(Guid surveyId, CancellationToken ct)
        => await Context.Set<SurveyResponse>().AsNoTracking().Where(r => r.SurveyId == surveyId).ToListAsync(ct);

    public async Task<List<(Guid SurveyId, DateTime SubmittedAt, string AnswersJson)>> GetResponseAnswersSinceAsync(DateTime since, CancellationToken ct)
        => (await Context.Set<SurveyResponse>().AsNoTracking()
                .Where(r => r.SubmittedAt >= since)
                .Select(r => new { r.SurveyId, r.SubmittedAt, r.AnswersJson })
                .ToListAsync(ct))
            .Select(r => (r.SurveyId, r.SubmittedAt, r.AnswersJson))
            .ToList();

    public async Task<Dictionary<Guid, int>> GetQuestionCountsAsync(CancellationToken ct)
        => await Context.Set<SurveyQuestion>()
            .GroupBy(q => q.SurveyId)
            .Select(g => new { SurveyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SurveyId, x => x.Count, ct);

    public async Task<Dictionary<Guid, SurveyQuestion>> GetQuestionMetaAsync(CancellationToken ct)
        => await Context.Set<SurveyQuestion>().AsNoTracking().ToDictionaryAsync(q => q.Id, ct);

    public async Task<List<SurveyResponse>> GetResponsesForParticipantAsync(Guid participantId, CancellationToken ct)
        => await Context.Set<SurveyResponse>()
            .AsNoTracking()
            .Where(r => r.ParticipantId == participantId)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);

    public async Task<HashSet<Guid>> GetSourceIdsByTypeAsync(string sourceType, CancellationToken ct)
    {
        var ids = await DbSet.IgnoreQueryFilters()
            .Where(s => s.SourceType == sourceType && s.SourceId != null)
            .Select(s => s.SourceId!.Value)
            .Distinct()
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    public Task<SurveyGlobalSettings?> GetGlobalSettingsAsync(CancellationToken ct)
        => Context.Set<SurveyGlobalSettings>().FirstOrDefaultAsync(ct);

    public async Task AddGlobalSettingsAsync(SurveyGlobalSettings settings, CancellationToken ct)
        => await Context.Set<SurveyGlobalSettings>().AddAsync(settings, ct);

    public void UpdateGlobalSettings(SurveyGlobalSettings settings)
        => Context.Set<SurveyGlobalSettings>().Update(settings);
}
