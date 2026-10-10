using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Halls.Dtos;

namespace Nexora.Application.Features.Halls;

public interface IHallService
{
    Task<PagedResult<HallDto>> GetPagedAsync(HallListParams p, CancellationToken ct);
    Task<HallSummaryDto> GetSummaryAsync(HallListParams p, CancellationToken ct);
    Task<HallDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<HallDto> CreateAsync(CreateHallRequest req, CancellationToken ct);
    Task<HallDto> UpdateAsync(Guid id, CreateHallRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<HallDto> ToggleStatusAsync(Guid id, CancellationToken ct);

    Task<Dictionary<string, string>> GetSeatPlanAsync(Guid id, CancellationToken ct);
    Task SaveSeatPlanAsync(Guid id, SeatPlanRequest req, CancellationToken ct);

    Task<HallFeatureCatalogDto> GetCatalogAsync(CancellationToken ct);
    Task<HallFeatureCatalogDto> CreateGroupAsync(FeatureGroupRequest req, CancellationToken ct);
    Task<HallFeatureCatalogDto> UpdateGroupAsync(string key, FeatureGroupRequest req, CancellationToken ct);
    Task<HallFeatureCatalogDto> DeleteGroupAsync(string key, CancellationToken ct);
    Task<HallFeatureCatalogDto> CreateFeatureAsync(FeatureRequest req, CancellationToken ct);
    Task<HallFeatureCatalogDto> UpdateFeatureAsync(string key, FeatureRequest req, CancellationToken ct);
    Task<HallFeatureCatalogDto> DeleteFeatureAsync(string key, CancellationToken ct);

    Task<List<HallFeatureTemplateDto>> GetTemplatesAsync(CancellationToken ct);
    Task<HallFeatureTemplateDto> CreateTemplateAsync(FeatureTemplateRequest req, CancellationToken ct);
    Task DeleteTemplateAsync(Guid id, CancellationToken ct);
}
