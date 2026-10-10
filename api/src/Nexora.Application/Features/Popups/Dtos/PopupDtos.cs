using Nexora.Application.Common.ApiResponse;

namespace Nexora.Application.Features.Popups.Dtos;

public record PopupMediaItemDto(int Order, string Type, string? Url, string? Text);

public record PopupCampaignDto(
    Guid Id,
    string Title,
    bool IsMandatory,
    bool AllowDismissForever,
    int RepeatIntervalHours,
    string TriggerType,
    string? TriggerModuleKey,
    DateTime? StartDate,
    DateTime? EndDate,
    int MinDisplaySeconds,
    bool IsActive,
    int Priority,
    int ViewCount,
    int AcknowledgeCount,
    List<PopupMediaItemDto> MediaItems,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record PopupMediaItemRequest(string Type, string? Url, string? Text);

public record UpsertPopupRequest(
    string Title,
    bool IsMandatory,
    bool AllowDismissForever,
    int RepeatIntervalHours,
    string TriggerType,
    string? TriggerModuleKey,
    DateTime? StartDate,
    DateTime? EndDate,
    int MinDisplaySeconds,
    bool IsActive,
    int Priority,
    List<PopupMediaItemRequest> MediaItems);

public record PopupListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public bool? IsMandatory { get; init; }
    public string? TriggerType { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record PopupSummaryDto(int Total, int Active, int Mandatory);

// --- Vatandaş tarafı ---

public record CitizenPopupMediaDto(int Order, string Type, string? Url, string? Text);

public record CitizenPopupDto(
    Guid Id,
    string Title,
    bool IsMandatory,
    bool AllowDismissForever,
    int MinDisplaySeconds,
    List<CitizenPopupMediaDto> MediaItems);

public record PopupAcknowledgeRequest(bool DismissForever = false);
