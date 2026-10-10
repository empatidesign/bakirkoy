using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Halls;

public class HallFeatureGroup : BaseEntity
{
    public string Key { get; private set; } = "";
    public string Name { get; private set; } = "";
    public string Color { get; private set; } = "blue";
    public int SortOrder { get; private set; }

    public static HallFeatureGroup Create(string key, string name, string color, int sortOrder)
        => new() { Key = key, Name = name.Trim(), Color = color, SortOrder = sortOrder };

    public void Update(string name, string color)
    {
        Name = name.Trim();
        Color = color;
    }
}
