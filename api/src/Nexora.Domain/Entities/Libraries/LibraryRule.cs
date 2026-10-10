using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryRule : BaseEntity
{
    public Guid? LibraryId { get; private set; }
    public string Category { get; private set; } = "general";
    public string Title { get; private set; } = "";
    public string Description { get; private set; } = "";
    public string Icon { get; private set; } = "";
    public string Severity { get; private set; } = "info";
    public bool IsActive { get; private set; } = true;

    public static LibraryRule Create(Guid? libraryId)
        => new() { LibraryId = libraryId, IsActive = true };

    public void SetDetails(string category, string title, string description, string icon, string severity)
    {
        Category = category;
        Title = title.Trim();
        Description = description.Trim();
        Icon = icon;
        Severity = severity;
    }

    public void SetStatus(bool active) => IsActive = active;
}
