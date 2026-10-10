using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Halls;

public class HallFeatureTemplate : BaseEntity
{
    public string Name { get; private set; } = "";
    public string? Description { get; private set; }
    public List<string> FeatureIds { get; private set; } = [];

    public static HallFeatureTemplate Create(string name, string? description, List<string> featureIds)
        => new()
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            FeatureIds = featureIds,
        };
}
