using System.Text.Json;
using Nexora.Application.Features.Halls.Dtos;

namespace Nexora.Application.Common;

public static class SeatGeometry
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static readonly IComparer<string?> KeyComparer = new SeatKeyComparer();

    public static Dictionary<string, int> BuildSegments(string? layoutJson)
    {
        var map = new Dictionary<string, int>();
        if (string.IsNullOrWhiteSpace(layoutJson)) return map;

        var layout = JsonSerializer.Deserialize<SeatingLayoutDto>(layoutJson, JsonOpts);
        if (layout is null) return map;

        foreach (var floor in layout.Floors)
        {
            for (var row = 0; row < floor.Rows; row++)
            {
                var seat = 0;
                var segments = RowSegments(floor, row);
                for (var segIdx = 0; segIdx < segments.Count; segIdx++)
                {
                    var count = Math.Max(0, segments[segIdx]);
                    for (var i = 0; i < count; i++)
                    {
                        seat++;
                        map[$"{floor.Id}:{row}:{seat}"] = segIdx;
                    }
                }
            }
        }
        return map;
    }

    public static List<string>? FindAdjacentBlock(SortedSet<string> free, int size, Dictionary<string, int> seatSegments)
    {
        if (size <= 0) return null;
        if (size == 1)
        {
            var single = free.Min;
            return single is null ? null : [single];
        }

        foreach (var segmentGroup in free
            .Select(SeatRef.Parse)
            .Where(r => r is not null)
            .Select(r => r!.Value)
            .GroupBy(r => (r.Floor, r.Row, Segment: seatSegments.GetValueOrDefault(r.Key, -1))))
        {
            if (segmentGroup.Key.Segment < 0) continue;
            var ordered = segmentGroup.OrderBy(r => r.Seat).ToList();
            for (var i = 0; i + size <= ordered.Count; i++)
            {
                var consecutive = true;
                for (var j = 1; j < size; j++)
                    if (ordered[i + j].Seat != ordered[i + j - 1].Seat + 1) { consecutive = false; break; }

                if (consecutive)
                    return Enumerable.Range(i, size).Select(k => ordered[k].Key).ToList();
            }
        }
        return null;
    }

    private static List<int> RowSegments(SeatingFloorDto floor, int row)
        => floor.RowOverrides.TryGetValue(row, out var ov) && ov.Count > 0 ? ov : floor.DefaultSegments;

    public readonly record struct SeatRef(string Floor, int Row, int Seat, string Key)
    {
        public static SeatRef? Parse(string key)
        {
            var lastColon = key.LastIndexOf(':');
            if (lastColon <= 0) return null;
            var prevColon = key.LastIndexOf(':', lastColon - 1);
            if (prevColon < 0) return null;

            if (!int.TryParse(key.AsSpan(prevColon + 1, lastColon - prevColon - 1), out var row)) return null;
            if (!int.TryParse(key.AsSpan(lastColon + 1), out var seat)) return null;

            return new SeatRef(key[..prevColon], row, seat, key);
        }
    }

    private sealed class SeatKeyComparer : IComparer<string?>
    {
        public int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y)) return 0;
            if (x is null) return -1;
            if (y is null) return 1;

            var a = SeatRef.Parse(x);
            var b = SeatRef.Parse(y);
            if (a is null || b is null) return string.CompareOrdinal(x, y);

            var floor = string.CompareOrdinal(a.Value.Floor, b.Value.Floor);
            if (floor != 0) return floor;
            var row = a.Value.Row.CompareTo(b.Value.Row);
            if (row != 0) return row;
            return a.Value.Seat.CompareTo(b.Value.Seat);
        }
    }
}
