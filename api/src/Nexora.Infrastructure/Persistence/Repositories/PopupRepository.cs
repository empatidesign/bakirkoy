using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Popups.Dtos;
using Nexora.Domain.Entities.Popups;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class PopupRepository(AppDbContext context)
    : Repository<PopupCampaign>(context), IPopupRepository
{
    public async Task<PagedResult<PopupCampaign>> GetPagedAsync(PopupListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Title, $"%{term}%"));
        }

        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        if (p.IsMandatory.HasValue) query = query.Where(x => x.IsMandatory == p.IsMandatory.Value);
        if (!string.IsNullOrWhiteSpace(p.TriggerType)) query = query.Where(x => x.TriggerType == p.TriggerType);

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "title" => desc ? query.OrderByDescending(x => x.Title) : query.OrderBy(x => x.Title),
            "priority" => desc ? query.OrderByDescending(x => x.Priority) : query.OrderBy(x => x.Priority),
            "createdat" => desc ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            _ => query.OrderByDescending(x => x.Priority).ThenByDescending(x => x.CreatedAt),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<(int Total, int Active, int Mandatory)> GetSummaryCountsAsync(CancellationToken ct)
    {
        var agg = await DbSet
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.IsActive),
                Mandatory = g.Count(x => x.IsMandatory),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0, 0) : (agg.Total, agg.Active, agg.Mandatory);
    }

    public async Task<List<PopupCampaign>> GetEligibleForTriggerAsync(string triggerType, string? moduleKey, DateTime now, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.IsActive && x.TriggerType == triggerType);

        if (triggerType == PopupTriggerTypes.ModuleEnter)
            query = query.Where(x => x.TriggerModuleKey == moduleKey);

        query = query.Where(x => (!x.StartDate.HasValue || x.StartDate.Value <= now)
            && (!x.EndDate.HasValue || x.EndDate.Value >= now));

        return await query.OrderByDescending(x => x.Priority).ThenBy(x => x.CreatedAt).ToListAsync(ct);
    }

    public Task<PopupView?> GetViewAsync(Guid popupCampaignId, Guid participantId, CancellationToken ct)
        => Context.Set<PopupView>().FirstOrDefaultAsync(
            v => v.PopupCampaignId == popupCampaignId && v.ParticipantId == participantId, ct);

    public async Task<Dictionary<Guid, PopupView>> GetViewsForParticipantAsync(
        IReadOnlyCollection<Guid> popupCampaignIds, Guid participantId, CancellationToken ct)
    {
        if (popupCampaignIds.Count == 0) return [];
        return await Context.Set<PopupView>()
            .Where(v => popupCampaignIds.Contains(v.PopupCampaignId) && v.ParticipantId == participantId)
            .ToDictionaryAsync(v => v.PopupCampaignId, ct);
    }

    public async Task AddViewAsync(PopupView view, CancellationToken ct)
        => await Context.Set<PopupView>().AddAsync(view, ct);

    public void UpdateView(PopupView view)
        => Context.Set<PopupView>().Update(view);
}
