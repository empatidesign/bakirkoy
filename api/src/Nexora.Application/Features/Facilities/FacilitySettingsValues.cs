using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

public static class FacilitySettingsValues
{
    public static int? Int(string? json, string key)
    {
        var el = Find(json, key);
        if (el is { ValueKind: JsonValueKind.Number } e && e.TryGetInt32(out var v)) return v;
        return null;
    }

    public static bool? Bool(string? json, string key)
    {
        var el = Find(json, key);
        return el?.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };
    }

    private static JsonElement? Find(string? json, string key)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty(key, out var el))
                return el.Clone();
        }
        catch { }
        return null;
    }
}
