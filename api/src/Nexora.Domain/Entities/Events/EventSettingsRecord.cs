using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public class EventSettingsRecord : BaseEntity
{
    public string ConfigJson { get; private set; } = string.Empty;

    public static EventSettingsRecord Create(string configJson) => new() { ConfigJson = configJson };

    public void Update(string configJson) => ConfigJson = configJson;
}
