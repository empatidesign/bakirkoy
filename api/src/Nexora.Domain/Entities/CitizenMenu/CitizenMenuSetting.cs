using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.CitizenMenu;

public class CitizenMenuSetting : BaseEntity
{
    public string ItemsJson { get; private set; } = "[]";

    public static CitizenMenuSetting Create(string itemsJson) => new()
    {
        ItemsJson = string.IsNullOrWhiteSpace(itemsJson) ? "[]" : itemsJson,
    };

    public void Update(string itemsJson)
    {
        ItemsJson = string.IsNullOrWhiteSpace(itemsJson) ? "[]" : itemsJson;
        UpdatedAt = DateTime.UtcNow;
    }
}
