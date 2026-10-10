using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibrarySettingsHistory : BaseEntity
{
    public Guid? LibraryId { get; private set; }
    public string? OldJson { get; private set; }
    public string NewJson { get; private set; } = "{}";
    public string? ChangedBy { get; private set; }

    public static LibrarySettingsHistory Create(Guid? libraryId, string? oldJson, string newJson, string? changedBy)
        => new() { LibraryId = libraryId, OldJson = oldJson, NewJson = newJson, ChangedBy = changedBy };
}
