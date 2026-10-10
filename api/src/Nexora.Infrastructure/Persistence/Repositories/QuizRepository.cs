using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class QuizRepository(AppDbContext context)
    : Repository<Quiz>(context), IQuizRepository
{
    public async Task<PagedResult<Quiz>> GetPagedAsync(QuizListParams p, CancellationToken ct)
    {
        var query = p.Archived == true
            ? DbSet.IgnoreQueryFilters().Where(q => q.IsDeleted)
            : DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(q => EF.Functions.ILike(q.Title, $"%{term}%") || EF.Functions.ILike(q.Description, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(q => q.Status == p.Status);

        if (p.CategoryId.HasValue)
            query = query.Where(q => q.CategoryId == p.CategoryId.Value);

        if (p.AgeGroupId.HasValue)
            query = query.Where(q => q.AgeGroupId == p.AgeGroupId.Value);

        if (p.EligibleForAgeGroupIds is { Length: > 0 })
            query = query.Where(q => q.AgeGroupId == null || p.EligibleForAgeGroupIds.Contains(q.AgeGroupId.Value));
        else if (p.OnlyAllAges == true)
            query = query.Where(q => q.AgeGroupId == null);

        if (p.IsActive.HasValue)
            query = query.Where(q => q.IsActive == p.IsActive.Value);

        if (p.ActiveWindowOnly == true)
        {
            // StartDate/EndDate DB'de UTC saklanıyor (timestamp without time zone, UTC değerli).
            // Burada TurkeyTime.NowWallClock() (UTC+3) ile karşılaştırılıyordu; bu, aralığı
            // sistematik olarak 3 saat erken kapatıyor ve "az önce başlamış / birkaç saat
            // sonra bitecek" kısa yarışmaların vatandaş listesinde HİÇ görünmemesine yol
            // açıyordu (2026-09-21 uçtan uca testinde canlı doğrulandı: aralık içindeki bir
            // quiz listede çıkmadı, EndDate +1 gün yapılınca anında çıktı).
            var nowUtc = DateTime.UtcNow;
            query = query.Where(q => q.EndDate >= nowUtc);
        }

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<Quiz> ApplySort(IQueryable<Quiz> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "title"     => desc ? query.OrderByDescending(q => q.Title)     : query.OrderBy(q => q.Title),
            "startdate" => desc ? query.OrderByDescending(q => q.StartDate) : query.OrderBy(q => q.StartDate),
            "status"    => desc ? query.OrderByDescending(q => q.Status)    : query.OrderBy(q => q.Status),
            "isactive"  => desc ? query.OrderByDescending(q => q.IsActive)  : query.OrderBy(q => q.IsActive),
            "createdat" => desc ? query.OrderByDescending(q => q.CreatedAt) : query.OrderBy(q => q.CreatedAt),
            _           => query.OrderByDescending(q => q.StartDate),
        };
    }

    public async Task<Quiz?> GetIncludingArchivedAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(q => q.Id == id, ct);

    public async Task<List<Quiz>> GetForOptionsAsync(CancellationToken ct)
        => await DbSet.OrderByDescending(q => q.StartDate).ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct)
        => await DbSet.Where(q => categoryIds.Contains(q.CategoryId))
            .GroupBy(q => q.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct)
        => await DbSet.CountAsync(q => q.CategoryId == categoryId, ct);

    public async Task<Dictionary<Guid, int>> CountByAgeGroupsAsync(List<Guid> ageGroupIds, CancellationToken ct)
        => await DbSet.Where(q => q.AgeGroupId != null && ageGroupIds.Contains(q.AgeGroupId.Value))
            .GroupBy(q => q.AgeGroupId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<int> CountByAgeGroupAsync(Guid ageGroupId, CancellationToken ct)
        => await DbSet.CountAsync(q => q.AgeGroupId == ageGroupId, ct);

    public async Task<Dictionary<Guid, int>> ParticipantCountsAsync(List<Guid> quizIds, CancellationToken ct)
        => await Context.Set<QuizParticipation>().Where(p => quizIds.Contains(p.QuizId))
            .GroupBy(p => p.QuizId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public async Task<List<QuizQuestion>> GetQuestionsAsync(Guid quizId, CancellationToken ct)
        => await Context.Set<QuizQuestion>().Where(q => q.QuizId == quizId).OrderBy(q => q.Order).ToListAsync(ct);

    public async Task ReplaceQuestionsAsync(Guid quizId, IEnumerable<QuizQuestion> questions, CancellationToken ct)
    {
        var existing = await Context.Set<QuizQuestion>().IgnoreQueryFilters().Where(q => q.QuizId == quizId).ToListAsync(ct);
        Context.Set<QuizQuestion>().RemoveRange(existing);
        await Context.Set<QuizQuestion>().AddRangeAsync(questions, ct);
    }

    public async Task<PagedResult<QuizParticipation>> GetParticipantsAsync(Guid quizId, QuizParticipantListParams p, CancellationToken ct)
    {
        var query = Context.Set<QuizParticipation>().Where(x => x.QuizId == quizId);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.ParticipantName, $"%{term}%") || x.Tckn.Contains(term));
        }

        query = ApplyParticipantSort(query, p.Sort, p.Order);

        var page = Math.Max(1, p.PageResolved);
        var limit = Math.Clamp(p.LimitResolved, 1, 100);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * limit).Take(limit).ToListAsync(ct);

        return new PagedResult<QuizParticipation> { Items = items, Total = total, Page = page, Limit = limit };
    }

    private static IQueryable<QuizParticipation> ApplyParticipantSort(IQueryable<QuizParticipation> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "participantname" => desc ? query.OrderByDescending(x => x.ParticipantName) : query.OrderBy(x => x.ParticipantName),
            "correctanswers"  => desc ? query.OrderByDescending(x => x.CorrectAnswers)  : query.OrderBy(x => x.CorrectAnswers),
            "score"           => desc ? query.OrderByDescending(x => x.Score)           : query.OrderBy(x => x.Score),
            "completedat"     => desc ? query.OrderByDescending(x => x.CompletedAt)     : query.OrderBy(x => x.CompletedAt),
            _                 => query.OrderByDescending(x => x.Score).ThenBy(x => x.TimeSpent),
        };
    }

    public async Task<QuizParticipation?> GetParticipationAsync(Guid quizId, Guid participationId, CancellationToken ct)
        => await Context.Set<QuizParticipation>().FirstOrDefaultAsync(x => x.QuizId == quizId && x.Id == participationId, ct);

    public async Task<List<QuizParticipation>> GetRankedParticipationsAsync(Guid quizId, CancellationToken ct)
        => await Context.Set<QuizParticipation>().Where(x => x.QuizId == quizId)
            .OrderByDescending(x => x.Score).ThenBy(x => x.TimeSpent).ToListAsync(ct);

    public async Task<List<QuizParticipation>> GetRankedByAgeGroupAsync(Guid quizId, Guid ageGroupId, CancellationToken ct)
        => await Context.Set<QuizParticipation>().Where(x => x.QuizId == quizId && x.AgeGroupId == ageGroupId)
            .OrderByDescending(x => x.Score).ThenBy(x => x.TimeSpent).ToListAsync(ct);

    public async Task<List<QuizParticipation>> GetRankedByCategoryAsync(Guid categoryId, CancellationToken ct)
        => await Context.Set<QuizParticipation>().Where(x => x.CategoryId == categoryId)
            .OrderByDescending(x => x.Score).ThenBy(x => x.TimeSpent).ToListAsync(ct);

    public async Task<(int Total, int Upcoming, int Ongoing, int Completed, int Active, int Passive)> GetSummaryCountsAsync(CancellationToken ct)
    {
        var agg = await DbSet
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Upcoming = g.Count(q => q.Status == "upcoming"),
                Ongoing = g.Count(q => q.Status == "ongoing"),
                Completed = g.Count(q => q.Status == "completed"),
                Active = g.Count(q => q.IsActive),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0, 0, 0)
            : (agg.Total, agg.Upcoming, agg.Ongoing, agg.Completed, agg.Active, agg.Total - agg.Active);
    }

    public async Task<(int TotalParticipants, int AverageScore)> GetParticipationSummaryAsync(CancellationToken ct)
    {
        var query = Context.Set<QuizParticipation>();
        var total = await query.CountAsync(ct);
        var average = total == 0 ? 0 : (int)Math.Round(await query.AverageAsync(x => (double)x.Score, ct));
        return (total, average);
    }

    public async Task<bool> ParticipationExistsAsync(Guid quizId, string tckn, CancellationToken ct)
        => await Context.Set<QuizParticipation>().AnyAsync(p => p.QuizId == quizId && p.Tckn == tckn, ct);

    public async Task<HashSet<Guid>> GetParticipatedQuizIdsAsync(IReadOnlyCollection<Guid> quizIds, string tckn, CancellationToken ct)
    {
        if (quizIds.Count == 0) return [];
        var ids = await Context.Set<QuizParticipation>()
            .Where(p => quizIds.Contains(p.QuizId) && p.Tckn == tckn)
            .Select(p => p.QuizId)
            .Distinct()
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    public async Task AddParticipationAsync(QuizParticipation participation, CancellationToken ct)
        => await Context.Set<QuizParticipation>().AddAsync(participation, ct);

    public async Task RemoveParticipationAsync(Guid quizId, string tckn, CancellationToken ct)
    {
        var existing = await Context.Set<QuizParticipation>()
            .Where(p => p.QuizId == quizId && p.Tckn == tckn)
            .ToListAsync(ct);
        if (existing.Count > 0)
            Context.Set<QuizParticipation>().RemoveRange(existing);
    }

    public async Task<List<string>> GetParticipantTcknsByQuizzesAsync(IReadOnlyCollection<Guid> quizIds, CancellationToken ct)
    {
        if (quizIds.Count == 0) return [];
        return await Context.Set<QuizParticipation>()
            .Where(p => quizIds.Contains(p.QuizId))
            .Select(p => p.Tckn)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<string>> GetParticipantTcknsByParticipationIdsAsync(IReadOnlyCollection<Guid> participationIds, CancellationToken ct)
    {
        if (participationIds.Count == 0) return [];
        return await Context.Set<QuizParticipation>()
            .Where(p => participationIds.Contains(p.Id))
            .Select(p => p.Tckn)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<QuizParticipation>> GetParticipationsByQuizIdsAsync(IReadOnlyCollection<Guid> quizIds, CancellationToken ct)
        => quizIds.Count == 0 ? [] : await Context.Set<QuizParticipation>().Where(p => quizIds.Contains(p.QuizId)).ToListAsync(ct);

    public async Task<List<QuizParticipation>> GetParticipationsByIdsAsync(IReadOnlyCollection<Guid> participationIds, CancellationToken ct)
        => participationIds.Count == 0 ? [] : await Context.Set<QuizParticipation>().Where(p => participationIds.Contains(p.Id)).ToListAsync(ct);

    public async Task HardDeleteAsync(Quiz quiz, CancellationToken ct)
    {
        var parts = await Context.Set<QuizParticipation>().IgnoreQueryFilters().Where(p => p.QuizId == quiz.Id).ToListAsync(ct);
        Context.Set<QuizParticipation>().RemoveRange(parts);

        var questions = await Context.Set<QuizQuestion>().IgnoreQueryFilters().Where(q => q.QuizId == quiz.Id).ToListAsync(ct);
        Context.Set<QuizQuestion>().RemoveRange(questions);

        Context.Set<Quiz>().Remove(quiz);
    }
}
