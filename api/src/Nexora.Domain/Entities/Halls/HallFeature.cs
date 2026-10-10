using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Halls;

public class HallFeature : BaseEntity
{
    public string Key { get; private set; } = "";
    public string Name { get; private set; } = "";
    public string GroupKey { get; private set; } = "";
    public int SortOrder { get; private set; }

    public static HallFeature Create(string key, string name, string groupKey, int sortOrder)
        => new() { Key = key, Name = name.Trim(), GroupKey = groupKey, SortOrder = sortOrder };

    public void Update(string name, string groupKey)
    {
        Name = name.Trim();
        GroupKey = groupKey;
    }
}
