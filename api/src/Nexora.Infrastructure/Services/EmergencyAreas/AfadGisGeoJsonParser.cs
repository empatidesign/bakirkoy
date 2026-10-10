using System.Globalization;
using System.Text.Json;
using Nexora.Application.Features.EmergencyAreas;

namespace Nexora.Infrastructure.Services.EmergencyAreas;

/// Netcad GIS API query/GeoJSON yanıtını <see cref="AfadGisAreaItem"/> listesine çevirir.
/// Kolon adları servis tarafında değişebileceği için hem features[].properties (gösterim adı) hem de
/// rows[].Cells[] (Path → tablo ön ekinden sonraki kolon adı, Value) okunur ve aday anahtar listeleriyle eşlenir.
internal static class AfadGisGeoJsonParser
{
    private static readonly string[] IdKeys = ["objectid", "object_id", "fid", "id"];
    private static readonly string[] NameKeys = ["adi", "ad", "alan_adi", "alanadi", "toplanma_alani_adi", "toplanma_alani", "tesis_adi", "isim", "name"];
    private static readonly string[] NeighborhoodKeys = ["mahalle", "mahalle_adi", "mahalleadi", "mah", "mahalle_ad", "neighborhood"];
    private static readonly string[] AddressKeys = ["adres", "acik_adres", "acikadres", "address"];
    private static readonly string[] CapacityKeys = ["kapasite", "kisi_kapasitesi", "kisi_sayisi", "kisi", "capacity"];
    private static readonly string[] AreaKeys = ["alan_m2", "alanm2", "alan", "yuzolcum", "yuzolcumu", "toplam_alan", "kullanilabilir_alan", "shape_area", "area"];

    public sealed record Page(IReadOnlyList<AfadGisAreaItem> Items, int RawCount, int? TotalRowCount);

    public static Page Parse(string json, AfadCoordinateConverter converter)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int? total = TryGetInt(root, "TotalRowCount");
        var features = root.TryGetProperty("features", out var f) && f.ValueKind == JsonValueKind.Array
            ? f.EnumerateArray().ToList() : [];
        var rows = root.TryGetProperty("rows", out var r) && r.ValueKind == JsonValueKind.Array
            ? r.EnumerateArray().ToList() : [];

        var count = Math.Max(features.Count, rows.Count);
        var items = new List<AfadGisAreaItem>(count);
        for (var i = 0; i < count; i++)
        {
            var attrs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (i < rows.Count) ReadCells(rows[i], attrs);
            JsonElement? geometry = null;
            if (i < features.Count)
            {
                var feature = features[i];
                if (feature.TryGetProperty("properties", out var props) && props.ValueKind == JsonValueKind.Object)
                    foreach (var p in props.EnumerateObject())
                        AddAttr(attrs, p.Name, ToText(p.Value));
                if (feature.TryGetProperty("id", out var fid))
                    AddAttr(attrs, "id", ToText(fid));
                if (feature.TryGetProperty("geometry", out var g) && g.ValueKind == JsonValueKind.Object)
                    geometry = g;
            }

            var id = ParseLong(Pick(attrs, IdKeys));
            if (id is null) continue;

            double? lat = null, lng = null;
            int? geomArea = null;
            if (geometry is { } geom && converter.TryGetCentroidAndArea(geom, out var c, out var areaM2))
            {
                lat = c.Lat; lng = c.Lng;
                geomArea = areaM2 > 0 ? (int)Math.Round(areaM2) : null;
            }

            var attrArea = ParseDouble(Pick(attrs, AreaKeys));
            items.Add(new AfadGisAreaItem(
                id.Value,
                Clean(Pick(attrs, NameKeys)),
                Clean(Pick(attrs, NeighborhoodKeys)),
                Clean(Pick(attrs, AddressKeys)),
                lat, lng,
                ParseDouble(Pick(attrs, CapacityKeys)) is { } cap ? (int)Math.Round(cap) : null,
                attrArea is > 0 ? (int)Math.Round(attrArea.Value) : geomArea));
        }

        return new Page(items, count, total);
    }

    private static void ReadCells(JsonElement row, Dictionary<string, string> attrs)
    {
        if (!row.TryGetProperty("Cells", out var cells) || cells.ValueKind != JsonValueKind.Array) return;
        foreach (var cell in cells.EnumerateArray())
        {
            var path = cell.TryGetProperty("Path", out var p) ? p.GetString() : null;
            var column = cell.TryGetProperty("ColumnName", out var cn) ? cn.GetString() : null;
            var key = !string.IsNullOrWhiteSpace(path) ? path![(path!.LastIndexOf('.') + 1)..] : column;
            if (string.IsNullOrWhiteSpace(key)) continue;
            var value = cell.TryGetProperty("Value", out var v) ? ToText(v) : null;
            if (string.IsNullOrWhiteSpace(value) && cell.TryGetProperty("DisplayText", out var dt))
                value = ToText(dt);
            AddAttr(attrs, key!, value);
            if (!string.IsNullOrWhiteSpace(column)) AddAttr(attrs, column!, value);
        }
    }

    private static void AddAttr(Dictionary<string, string> attrs, string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        attrs.TryAdd(Normalize(key), value);
    }

    private static string? Pick(Dictionary<string, string> attrs, string[] keys)
    {
        foreach (var k in keys)
            if (attrs.TryGetValue(k, out var v)) return v;
        return null;
    }

    /// "Mahalle Adı" → "mahalle_adi", "ALAN(m²)" → "alan_m2" gibi sade anahtara çevirir.
    internal static string Normalize(string key)
    {
        var lower = key.Trim().ToLower(new CultureInfo("tr-TR"))
            .Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u').Replace('ş', 's').Replace('ö', 'o').Replace('ç', 'c')
            .Replace("²", "2");
        var chars = lower.Select(ch => char.IsLetterOrDigit(ch) ? ch : '_').ToArray();
        return string.Join('_', new string(chars).Split('_', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string? ToText(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.String => v.GetString(),
        JsonValueKind.Number => v.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => null,
    };

    private static string? Clean(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return string.Join(' ', s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    private static long? ParseLong(string? s)
        => ParseDouble(s) is { } d && d == Math.Floor(d) ? (long)d : null;

    internal static double? ParseDouble(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d)) return d;
        // "1.234,56" (tr-TR) biçimi
        if (double.TryParse(s, NumberStyles.Float | NumberStyles.AllowThousands, new CultureInfo("tr-TR"), out d)) return d;
        return null;
    }

    private static int? TryGetInt(JsonElement root, string name)
    {
        foreach (var p in root.EnumerateObject())
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase) && p.Value.ValueKind == JsonValueKind.Number)
                return p.Value.GetInt32();
        return null;
    }
}
