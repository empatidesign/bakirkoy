using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public class FacilitySettingsRecord : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public string Scope { get; private set; } = "general";
    public Guid? FacilityId { get; private set; }
    public bool UseGeneral { get; private set; } = true;
    public string SettingsJson { get; private set; } = "{}";
    public string? UpdatedBy { get; private set; }

    public static FacilitySettingsRecord CreateGeneral(string module, string settingsJson, string? actor)
    {
        return new FacilitySettingsRecord
        {
            Module = module,
            Scope = "general",
            FacilityId = null,
            UseGeneral = false,
            SettingsJson = string.IsNullOrWhiteSpace(settingsJson) ? "{}" : settingsJson,
            UpdatedBy = actor,
        };
    }

    public static FacilitySettingsRecord CreateForFacility(string module, Guid facilityId, bool useGeneral, string settingsJson, string? actor)
    {
        return new FacilitySettingsRecord
        {
            Module = module,
            Scope = "facility",
            FacilityId = facilityId,
            UseGeneral = useGeneral,
            SettingsJson = string.IsNullOrWhiteSpace(settingsJson) ? "{}" : settingsJson,
            UpdatedBy = actor,
        };
    }

    public void SetSettings(bool useGeneral, string settingsJson, string? actor)
    {
        UseGeneral = useGeneral;
        SettingsJson = string.IsNullOrWhiteSpace(settingsJson) ? "{}" : settingsJson;
        UpdatedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }
}
