using Nexora.Domain.Entities.Halls;

namespace Nexora.Application.Common.Repositories;

public interface IHallFeatureRepository
{
    Task<List<HallFeatureGroup>> GetGroupsAsync(CancellationToken ct);
    Task<List<HallFeature>> GetFeaturesAsync(CancellationToken ct);
    Task<List<HallFeature>> GetFeaturesByGroupAsync(string groupKey, CancellationToken ct);
    Task<HallFeatureGroup?> GetGroupByKeyAsync(string key, CancellationToken ct);
    Task<HallFeature?> GetFeatureByKeyAsync(string key, CancellationToken ct);
    Task<bool> GroupKeyExistsAsync(string key, CancellationToken ct);
    Task<bool> FeatureKeyExistsAsync(string key, CancellationToken ct);
    Task<int> GroupCountAsync(CancellationToken ct);
    Task<int> FeatureCountAsync(CancellationToken ct);
    Task AddGroupAsync(HallFeatureGroup group, CancellationToken ct);
    Task AddFeatureAsync(HallFeature feature, CancellationToken ct);
    void UpdateGroup(HallFeatureGroup group);
    void UpdateFeature(HallFeature feature);
    void DeleteGroup(HallFeatureGroup group);
    void DeleteFeature(HallFeature feature);
    Task<List<HallFeatureTemplate>> GetTemplatesAsync(CancellationToken ct);
    Task<HallFeatureTemplate?> GetTemplateAsync(Guid id, CancellationToken ct);
    Task AddTemplateAsync(HallFeatureTemplate template, CancellationToken ct);
    void DeleteTemplate(HallFeatureTemplate template);
}
