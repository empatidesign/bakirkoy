using System.Text.Json;
using Nexora.Application.Configuration;

namespace Nexora.Infrastructure.Services.EmergencyAreas;

/// GeoJSON geometrisinden merkez nokta (WGS84 lat/lng) ve yüzölçümü (m²) hesaplar.
/// Netcad servisleri geometriyi ya coğrafi (lon/lat) ya da projeksiyonlu (ITRF96 3° TM, metre) döndürebilir;
/// değer aralığına bakılarak otomatik ayırt edilir. Projeksiyonlu ise GRS80 üzerinde ters Transverse Mercator uygulanır.
internal sealed class AfadCoordinateConverter(double centralMeridianDeg, double scaleFactor, double falseEasting = 500000)
{
    public static AfadCoordinateConverter From(AfadGisSettings s) => new(s.CentralMeridian, s.ScaleFactor);

    public readonly record struct LatLng(double Lat, double Lng);

    public bool TryGetCentroidAndArea(JsonElement geometry, out LatLng centroid, out double areaM2)
    {
        centroid = default;
        areaM2 = 0;
        if (!geometry.TryGetProperty("type", out var typeEl) || !geometry.TryGetProperty("coordinates", out var coords))
            return false;

        var rings = new List<List<(double X, double Y)>>(); // her poligonun dış halkası (delikler ihmal edilir)
        switch (typeEl.GetString())
        {
            case "Point":
                var pt = ReadPoint(coords);
                if (pt is null) return false;
                centroid = ToLatLng(pt.Value.X, pt.Value.Y);
                return IsValid(centroid);
            case "MultiPoint":
            case "LineString":
                rings.Add(ReadRing(coords));
                break;
            case "Polygon":
                if (coords.GetArrayLength() > 0) rings.Add(ReadRing(coords[0]));
                break;
            case "MultiPolygon":
                foreach (var poly in coords.EnumerateArray())
                    if (poly.GetArrayLength() > 0) rings.Add(ReadRing(poly[0]));
                break;
            default:
                return false;
        }

        rings.RemoveAll(r => r.Count == 0);
        if (rings.Count == 0) return false;

        // Tüm köşeler önce WGS84'e çevrilir (X=lng, Y=lat), sonra ilk köşeye göre yerel metre düzlemine alınır.
        var geoRings = rings.Select(r => r.Select(p => { var ll = ToLatLng(p.X, p.Y); return (X: ll.Lng, Y: ll.Lat); }).ToList()).ToList();
        var origin = geoRings[0][0];
        double sumA = 0, sumX = 0, sumY = 0;
        foreach (var ring in geoRings)
        {
            var pts = ToLocalMeters(ring, origin);
            var (a, cx, cy) = Shoelace(pts);
            if (Math.Abs(a) < 1e-9)
            {
                // Çizgi/nokta kümesi veya dejenere poligon: köşelerin ortalaması.
                cx = pts.Average(p => p.X); cy = pts.Average(p => p.Y); a = 0;
            }
            var w = Math.Abs(a) > 0 ? Math.Abs(a) : 1e-9;
            sumA += Math.Abs(a); sumX += cx * w; sumY += cy * w;
        }
        var totalW = sumA > 0 ? sumA : 1e-9 * rings.Count;
        var (mx, my) = (sumX / totalW, sumY / totalW);
        areaM2 = sumA;

        var mPerDegLng = MetersPerDegLat * Math.Cos(origin.Y * Math.PI / 180);
        centroid = new LatLng(origin.Y + my / MetersPerDegLat, origin.X + mx / mPerDegLng);
        return IsValid(centroid);
    }

    private const double MetersPerDegLat = 111_320.0;

    /// Koordinat sistemini değer aralığından tespit eder (Türkiye için):
    /// - |x|≤180, |y|≤90 → WGS84 lon/lat (EPSG:4326)
    /// - x &gt; y → eksenleri yer değiştirmiş TM (Netcad Sağa/Yukarı sırası)
    /// - x &gt; 1.000.000 → Web Mercator (EPSG:3857); TM doğu değerleri 100-900 bin aralığındadır
    /// - aksi halde ITRF96 / TM (EPSG:5254 vb.)
    internal LatLng ToLatLng(double x, double y)
    {
        if (Math.Abs(x) <= 180 && Math.Abs(y) <= 90) return new LatLng(y, x);
        if (x > y) (x, y) = (y, x);
        if (x > 1_000_000) return InverseWebMercator(x, y);
        return InverseTm(x, y);
    }

    private static LatLng InverseWebMercator(double x, double y)
    {
        const double r = 6378137.0;
        var lng = x / r * 180 / Math.PI;
        var lat = (2 * Math.Atan(Math.Exp(y / r)) - Math.PI / 2) * 180 / Math.PI;
        return new LatLng(lat, lng);
    }

    private static List<(double X, double Y)> ToLocalMeters(List<(double X, double Y)> ring, (double X, double Y) origin)
    {
        var mPerDegLng = MetersPerDegLat * Math.Cos(origin.Y * Math.PI / 180);
        return ring.Select(p => ((p.X - origin.X) * mPerDegLng, (p.Y - origin.Y) * MetersPerDegLat)).ToList();
    }

    private static (double Area, double Cx, double Cy) Shoelace(List<(double X, double Y)> pts)
    {
        double a = 0, cx = 0, cy = 0;
        // Büyük koordinatlarda sayısal kararlılık için ilk noktaya göre ötele.
        var (ox, oy) = pts[0];
        for (var i = 0; i < pts.Count; i++)
        {
            var (x0, y0) = (pts[i].X - ox, pts[i].Y - oy);
            var (x1, y1) = (pts[(i + 1) % pts.Count].X - ox, pts[(i + 1) % pts.Count].Y - oy);
            var cross = x0 * y1 - x1 * y0;
            a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
        }
        a /= 2;
        if (Math.Abs(a) < 1e-9) return (0, 0, 0);
        return (a, cx / (6 * a) + ox, cy / (6 * a) + oy);
    }

    private static (double X, double Y)? ReadPoint(JsonElement c)
        => c.ValueKind == JsonValueKind.Array && c.GetArrayLength() >= 2
            && c[0].ValueKind == JsonValueKind.Number && c[1].ValueKind == JsonValueKind.Number
            ? (c[0].GetDouble(), c[1].GetDouble()) : null;

    private static List<(double X, double Y)> ReadRing(JsonElement ring)
    {
        var list = new List<(double X, double Y)>();
        if (ring.ValueKind != JsonValueKind.Array) return list;
        foreach (var c in ring.EnumerateArray())
            if (ReadPoint(c) is { } p) list.Add(p);
        if (list.Count > 1 && list[0] == list[^1]) list.RemoveAt(list.Count - 1);
        return list;
    }

    private static bool IsValid(LatLng c)
        => !double.IsNaN(c.Lat) && !double.IsNaN(c.Lng) && Math.Abs(c.Lat) <= 90 && Math.Abs(c.Lng) <= 180;

    // GRS80 (ITRF96) ters Transverse Mercator — Snyder, "Map Projections: A Working Manual", s. 63-64.
    private LatLng InverseTm(double easting, double northing)
    {
        const double a = 6378137.0;
        const double f = 1 / 298.257222101;
        var e2 = f * (2 - f);
        var ep2 = e2 / (1 - e2);
        var k0 = scaleFactor;
        var lon0 = centralMeridianDeg * Math.PI / 180;

        var m = northing / k0;
        var mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
        var e1 = (1 - Math.Sqrt(1 - e2)) / (1 + Math.Sqrt(1 - e2));
        var phi1 = mu
            + (3 * e1 / 2 - 27 * Math.Pow(e1, 3) / 32) * Math.Sin(2 * mu)
            + (21 * e1 * e1 / 16 - 55 * Math.Pow(e1, 4) / 32) * Math.Sin(4 * mu)
            + (151 * Math.Pow(e1, 3) / 96) * Math.Sin(6 * mu)
            + (1097 * Math.Pow(e1, 4) / 512) * Math.Sin(8 * mu);

        var sin1 = Math.Sin(phi1);
        var cos1 = Math.Cos(phi1);
        var tan1 = Math.Tan(phi1);
        var c1 = ep2 * cos1 * cos1;
        var t1 = tan1 * tan1;
        var n1 = a / Math.Sqrt(1 - e2 * sin1 * sin1);
        var r1 = a * (1 - e2) / Math.Pow(1 - e2 * sin1 * sin1, 1.5);
        var d = (easting - falseEasting) / (n1 * k0);

        var lat = phi1 - n1 * tan1 / r1 * (
            d * d / 2
            - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * Math.Pow(d, 4) / 24
            + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * Math.Pow(d, 6) / 720);
        var lon = lon0 + (
            d
            - (1 + 2 * t1 + c1) * Math.Pow(d, 3) / 6
            + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * Math.Pow(d, 5) / 120) / cos1;

        return new LatLng(lat * 180 / Math.PI, lon * 180 / Math.PI);
    }
}
