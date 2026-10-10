namespace Nexora.Application.Features.Facilities;

public record FacilityDocumentType(string Key, string Label, bool Required, IReadOnlyList<string>? AllowedFormats = null);

public record FacilityModuleRule(
    bool RequiresApplicationDocuments = false,
    string? DocumentsRequiredMessage = null,
    bool RequiresHealthReport = false,
    string? HealthReportRequiredMessage = null,
    IReadOnlyList<FacilityDocumentType>? RequiredDocumentTypes = null)
{
    public IReadOnlyList<FacilityDocumentType> DocumentTypes => RequiredDocumentTypes ?? [];
}

public static class FacilityModuleRegistry
{
    public static readonly IReadOnlyDictionary<string, string> Prefix = new Dictionary<string, string>
    {
        ["sports"] = "SPR",
        ["pool"] = "HVZ",
        ["youth-camp"] = "GKMP",
        ["scout-camp"] = "IKMP",
        ["science-center"] = "BLM",
        ["kasif"] = "KSF",
        ["accessible-life"] = "ENG",
        ["women-family"] = "KAD",
    };

    private static readonly FacilityModuleRule DefaultRule = new();

    public static readonly IReadOnlyDictionary<string, FacilityModuleRule> Rules = new Dictionary<string, FacilityModuleRule>
    {
        ["accessible-life"] = new(
            RequiresApplicationDocuments: true,
            DocumentsRequiredMessage: "Engelsiz Yaşam başvurusu için evrak yüklenmesi zorunludur.",
            RequiredDocumentTypes:
            [
                new("disability_report", "SGK Engelli Sağlık Raporu", true),
                new("health_report", "Sağlık Raporu", true),
                new("residence", "İkametgâh Belgesi", true),
            ]),
    };

    public static readonly string[] All = Prefix.Keys.ToArray();

    public static bool IsValid(string module) => Prefix.ContainsKey(module);

    public static FacilityModuleRule RulesFor(string module) => Rules.TryGetValue(module, out var r) ? r : DefaultRule;

    public static string? DetectFromRoleKey(string? roleKey)
    {
        if (string.IsNullOrEmpty(roleKey)) return null;
        foreach (var module in All)
            if (roleKey.Contains(module, StringComparison.OrdinalIgnoreCase))
                return module;
        return null;
    }
}
