using System.Text.Json;

namespace Nexora.Application.Common;

public static class BusSeatMath
{
    private static readonly Dictionary<string, int> TemplateSeats = new()
    {
        ["intercity_2plus1_39"] = 43,
        ["tour_2plus2_44"] = 49,
        ["minibus_2plus1_20"] = 20,
        ["midibus_2plus2_30"] = 30,
        ["standard_2plus2_38"] = 38,
    };

    public static int TemplateCapacity(string? templateId)
        => templateId is not null && TemplateSeats.TryGetValue(templateId, out var n) ? n : 0;

    public static (int Capacity, int Occupied) FromSeatStates(string? seatStatesJson, string? templateId = null)
    {
        if (string.IsNullOrWhiteSpace(seatStatesJson))
            return (TemplateCapacity(templateId), 0);

        try
        {
            using var doc = JsonDocument.Parse(seatStatesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return (TemplateCapacity(templateId), 0);

            var capacity = 0;
            var occupied = 0;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object) continue;
                var status = prop.Value.TryGetProperty("status", out var st) ? st.GetString() : null;
                if (status is "driver" or "guide" or "hidden") continue;
                capacity++;
                if (status == "occupied") occupied++;
            }

            return capacity > 0 ? (capacity, occupied) : (TemplateCapacity(templateId), occupied);
        }
        catch
        {
            return (TemplateCapacity(templateId), 0);
        }
    }

    public static int OpenSeats(string? seatStatesJson, string? templateId = null)
    {
        if (string.IsNullOrWhiteSpace(seatStatesJson))
            return TemplateCapacity(templateId);

        try
        {
            using var doc = JsonDocument.Parse(seatStatesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return TemplateCapacity(templateId);

            var open = 0;
            var sawPassenger = false;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object) continue;
                var status = prop.Value.TryGetProperty("status", out var st) ? st.GetString() : null;
                if (status is "driver" or "guide" or "hidden") continue;
                sawPassenger = true;
                if (status != "blocked") open++;
            }

            return sawPassenger ? open : TemplateCapacity(templateId);
        }
        catch
        {
            return TemplateCapacity(templateId);
        }
    }

    public static Dictionary<string, string> LockedSeats(string? seatStatesJson)
    {
        var locked = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(seatStatesJson)) return locked;

        try
        {
            using var doc = JsonDocument.Parse(seatStatesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return locked;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object) continue;
                var status = prop.Value.TryGetProperty("status", out var st) ? st.GetString() : null;
                if (status is "blocked" or "driver" or "guide" or "hidden")
                    locked[prop.Name] = status;
            }
        }
        catch
        {
            return locked;
        }

        return locked;
    }

    public static HashSet<string> HiddenSeatIds(string? seatStatesJson)
    {
        var hidden = new HashSet<string>();
        if (string.IsNullOrWhiteSpace(seatStatesJson)) return hidden;

        try
        {
            using var doc = JsonDocument.Parse(seatStatesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return hidden;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object) continue;
                var status = prop.Value.TryGetProperty("status", out var st) ? st.GetString() : null;
                if (status == "hidden") hidden.Add(prop.Name);
            }
        }
        catch
        {
            return hidden;
        }

        return hidden;
    }
}
