using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class HallFeatureRepository(AppDbContext context) : IHallFeatureRepository
{
    private readonly DbSet<HallFeatureGroup> _groups = context.Set<HallFeatureGroup>();
    private readonly DbSet<HallFeature> _features = context.Set<HallFeature>();
    private readonly DbSet<HallFeatureTemplate> _templates = context.Set<HallFeatureTemplate>();

    public async Task<List<HallFeatureGroup>> GetGroupsAsync(CancellationToken ct)
        => await _groups.OrderBy(g => g.SortOrder).ThenBy(g => g.Name).ToListAsync(ct);

    public async Task<List<HallFeature>> GetFeaturesAsync(CancellationToken ct)
        => await _features.OrderBy(f => f.SortOrder).ThenBy(f => f.Name).ToListAsync(ct);

    public async Task<List<HallFeature>> GetFeaturesByGroupAsync(string groupKey, CancellationToken ct)
        => await _features.Where(f => f.GroupKey == groupKey).ToListAsync(ct);

    public async Task<HallFeatureGroup?> GetGroupByKeyAsync(string key, CancellationToken ct)
        => await _groups.FirstOrDefaultAsync(g => g.Key == key, ct);

    public async Task<HallFeature?> GetFeatureByKeyAsync(string key, CancellationToken ct)
        => await _features.FirstOrDefaultAsync(f => f.Key == key, ct);

    public async Task<bool> GroupKeyExistsAsync(string key, CancellationToken ct)
        => await _groups.AnyAsync(g => g.Key == key, ct);

    public async Task<bool> FeatureKeyExistsAsync(string key, CancellationToken ct)
        => await _features.AnyAsync(f => f.Key == key, ct);

    public async Task<int> GroupCountAsync(CancellationToken ct) => await _groups.CountAsync(ct);

    public async Task<int> FeatureCountAsync(CancellationToken ct) => await _features.CountAsync(ct);

    public async Task AddGroupAsync(HallFeatureGroup group, CancellationToken ct)
        => await _groups.AddAsync(group, ct);

    public async Task AddFeatureAsync(HallFeature feature, CancellationToken ct)
        => await _features.AddAsync(feature, ct);

    public void UpdateGroup(HallFeatureGroup group) => _groups.Update(group);

    public void UpdateFeature(HallFeature feature) => _features.Update(feature);

    public void DeleteGroup(HallFeatureGroup group)
    {
        group.IsDeleted = true;
        group.DeletedAt = DateTime.UtcNow;
        _groups.Update(group);
    }

    public void DeleteFeature(HallFeature feature)
    {
        feature.IsDeleted = true;
        feature.DeletedAt = DateTime.UtcNow;
        _features.Update(feature);
    }

    public async Task<List<HallFeatureTemplate>> GetTemplatesAsync(CancellationToken ct)
        => await _templates.OrderByDescending(t => t.CreatedAt).ToListAsync(ct);

    public async Task<HallFeatureTemplate?> GetTemplateAsync(Guid id, CancellationToken ct)
        => await _templates.FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task AddTemplateAsync(HallFeatureTemplate template, CancellationToken ct)
        => await _templates.AddAsync(template, ct);

    public void DeleteTemplate(HallFeatureTemplate template)
    {
        template.IsDeleted = true;
        template.DeletedAt = DateTime.UtcNow;
        _templates.Update(template);
    }
}
