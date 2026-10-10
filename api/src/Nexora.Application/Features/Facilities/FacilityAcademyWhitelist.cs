using System.Text.Json;

namespace Nexora.Application.Features.Facilities;

public static class FacilityAcademyWhitelist
{
    public static bool IsAllowed(string? json, string tckn)
    {
        if (string.IsNullOrWhiteSpace(tckn)) return false;
        foreach (var t in Parse(json))
            if (t == tckn) return true;
        return false;
    }

    public static IReadOnlyList<string> Parse(string? json)
    {
        var list = new List<string>();
        if (string.IsNullOrWhiteSpace(json)) return list;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return list;
            foreach (var e in doc.RootElement.EnumerateArray())
                if (e.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(e.GetString()))
                    list.Add(e.GetString()!.Trim());
        }
        catch { }
        return list;
    }
}
