using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibrarySettings : BaseEntity
{
    public Guid? LibraryId { get; private set; }
    public string SettingsJson { get; private set; } = "{}";

    public static LibrarySettings Create(Guid? libraryId, string settingsJson)
        => new() { LibraryId = libraryId, SettingsJson = settingsJson };

    public void SetJson(string settingsJson) => SettingsJson = settingsJson;
}
