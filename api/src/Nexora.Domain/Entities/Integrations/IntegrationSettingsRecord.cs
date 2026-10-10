using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Integrations;

public class IntegrationSettingsRecord : BaseEntity
{
    public string ConfigJson { get; private set; } = "{}";

    public static IntegrationSettingsRecord Create(string configJson) => new() { ConfigJson = configJson };

    public void Update(string configJson) => ConfigJson = configJson;
}
