using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.AppMenu;

public class SystemModule : BaseEntity
{
    public string Key { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public string Color { get; private set; } = "#1486C9";
    public string CitizenRoute { get; private set; } = string.Empty;
    public string AdminRoute { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
    public int AdminSidebarOrder { get; private set; }
    public bool ShowInAdminSidebar { get; private set; } = true;

    public ICollection<MenuItem> MenuItems { get; private set; } = [];

    public static SystemModule Create(
        string key, string label, string icon, string color,
        string citizenRoute, string adminRoute,
        bool isActive, int adminSidebarOrder, bool showInAdminSidebar)
        => new()
        {
            Key = key.Trim(),
            Label = label.Trim(),
            Icon = icon.Trim(),
            Color = color.Trim(),
            CitizenRoute = citizenRoute.Trim(),
            AdminRoute = adminRoute.Trim(),
            IsActive = isActive,
            AdminSidebarOrder = adminSidebarOrder,
            ShowInAdminSidebar = showInAdminSidebar,
        };

    public void Update(string label, string icon, string color,
        string citizenRoute, string adminRoute,
        bool isActive, int adminSidebarOrder, bool showInAdminSidebar)
    {
        Label = label.Trim();
        Icon = icon.Trim();
        Color = color.Trim();
        CitizenRoute = citizenRoute.Trim();
        AdminRoute = adminRoute.Trim();
        IsActive = isActive;
        AdminSidebarOrder = adminSidebarOrder;
        ShowInAdminSidebar = showInAdminSidebar;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAdminOrder(int order)
    {
        AdminSidebarOrder = order;
        UpdatedAt = DateTime.UtcNow;
    }
}
