using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Popups.Dtos;
using Nexora.Domain.Entities.Popups;

namespace Nexora.Application.Common.Repositories;

public interface IPopupRepository : IRepository<PopupCampaign>
{
    Task<PagedResult<PopupCampaign>> GetPagedAsync(PopupListParams p, CancellationToken ct);
    Task<(int Total, int Active, int Mandatory)> GetSummaryCountsAsync(CancellationToken ct);

    // Vatandaşa aktif+zaman aralığı geçerli+tetikleme tipine uyan popup'ları döner.
    Task<List<PopupCampaign>> GetEligibleForTriggerAsync(string triggerType, string? moduleKey, DateTime now, CancellationToken ct);

    Task<PopupView?> GetViewAsync(Guid popupCampaignId, Guid participantId, CancellationToken ct);
    Task<Dictionary<Guid, PopupView>> GetViewsForParticipantAsync(IReadOnlyCollection<Guid> popupCampaignIds, Guid participantId, CancellationToken ct);
    Task AddViewAsync(PopupView view, CancellationToken ct);
    void UpdateView(PopupView view);
}
