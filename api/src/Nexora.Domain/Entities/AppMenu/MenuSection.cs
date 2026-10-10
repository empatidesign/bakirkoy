using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.AppMenu;

public class MenuSection : BaseEntity
{
    public string Key { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public bool IsVisible { get; private set; } = true;
    public bool ShowInSidebar { get; private set; } = true;
    public bool ShowInMobile { get; private set; } = true;
    public int Order { get; private set; }

    public ICollection<MenuItem> Items { get; private set; } = [];

    public static MenuSection Create(string key, string title, string icon, bool isVisible, bool showInSidebar, bool showInMobile, int order)
        => new()
        {
            Key = key.Trim(),
            Title = title.Trim(),
            Icon = icon.Trim(),
            IsVisible = isVisible,
            ShowInSidebar = showInSidebar,
            ShowInMobile = showInMobile,
            Order = order,
        };

    public void Update(string title, string icon, bool isVisible, bool showInSidebar, bool showInMobile)
    {
        Title = title.Trim();
        Icon = icon.Trim();
        IsVisible = isVisible;
        ShowInSidebar = showInSidebar;
        ShowInMobile = showInMobile;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOrder(int order)
    {
        Order = order;
        UpdatedAt = DateTime.UtcNow;
    }
}
