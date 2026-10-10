using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Popups.Dtos;

namespace Nexora.Application.Features.Popups;

public interface IPopupService
{
    // --- Admin ---
    Task<PagedResult<PopupCampaignDto>> GetPagedAsync(PopupListParams p, CancellationToken ct);
    Task<PopupSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<PopupCampaignDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<PopupCampaignDto> CreateAsync(UpsertPopupRequest req, CancellationToken ct);
    Task<PopupCampaignDto> UpdateAsync(Guid id, UpsertPopupRequest req, CancellationToken ct);
    Task<PopupCampaignDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<string> UploadMediaAsync(Stream stream, string fileName, string contentType, CancellationToken ct);

    // --- Vatandaş ---
    /// <summary>Belirli bir tetiklemede (ilk giriş / her giriş / modüle giriş) vatandaşa gösterilecek
    /// EN AZ ÖNCELİKLİ popup'ı döner (aynı anda birden fazla popup art arda bombardıman etmesin diye
    /// tek popup döner — kapatıldıktan sonra istemci tekrar sorar, sıradaki varsa o gelir).</summary>
    Task<CitizenPopupDto?> GetNextForTriggerAsync(string triggerType, string? moduleKey, CancellationToken ct);
    Task AcknowledgeAsync(Guid popupId, PopupAcknowledgeRequest req, CancellationToken ct);
}
