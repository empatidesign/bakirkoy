using System.Text.Json;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Infrastructure.Services;

public static class HallSeatLabeler
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private sealed record LayoutFloor(string? Id, string? Name, int Rows, bool SkipIO, string? RowLabelStart);

    private sealed record LayoutRoot(List<LayoutFloor>? Floors);

    public static string? Resolve(Hall? hall, string? seatKey)
    {
        if (string.IsNullOrWhiteSpace(seatKey)) return null;

        var parts = seatKey.Split(':');
        if (parts.Length < 3) return seatKey;

        var seatNo = parts[^1];
        if (!int.TryParse(parts[^2], out var rowIndex)) return seatKey;

        var floor = FindFloor(hall, parts[0]);
        if (floor is null) return seatKey;

        var rowLabel = RowLabel(floor, rowIndex);
        if (rowLabel is null) return seatKey;

        return string.IsNullOrWhiteSpace(floor.Name)
            ? $"{rowLabel}-{seatNo}"
            : $"{floor.Name} · {rowLabel}-{seatNo}";
    }

    private static LayoutFloor? FindFloor(Hall? hall, string floorId)
    {
        if (hall is null || string.IsNullOrWhiteSpace(hall.LayoutJson)) return null;
        try
        {
            var root = JsonSerializer.Deserialize<LayoutRoot>(hall.LayoutJson, JsonOpts);
            return root?.Floors?.FirstOrDefault(f => f.Id == floorId);
        }
        catch
        {
            return null;
        }
    }

    private static string? RowLabel(LayoutFloor floor, int rowIndex)
    {
        if (rowIndex < 0) return null;

        var letters = (floor.SkipIO ? Alphabet.Replace("I", "").Replace("O", "") : Alphabet).ToCharArray();
        if (letters.Length == 0) return null;

        var start = string.IsNullOrWhiteSpace(floor.RowLabelStart) ? "A" : floor.RowLabelStart.ToUpperInvariant();

        var sequence = new List<string>();
        var repeat = 1;
        var needed = Math.Max(floor.Rows, rowIndex + 1) + letters.Length;
        while (sequence.Count < needed)
        {
            foreach (var letter in letters) sequence.Add(new string(letter, repeat));
            repeat++;
        }

        var startIndex = sequence.IndexOf(start);
        if (startIndex < 0) startIndex = 0;

        var target = startIndex + rowIndex;
        return target < sequence.Count ? sequence[target] : null;
    }
}
