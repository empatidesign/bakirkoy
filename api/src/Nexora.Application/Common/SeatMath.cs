using System.Text.Json;

namespace Nexora.Application.Common;

public static class SeatMath
{
    private static readonly HashSet<string> OccupiedStatuses = ["reserved", "protocol", "closed"];

    public static bool IsOccupiedState(string? status)
        => status is not null && OccupiedStatuses.Contains(status);

    public static int CountOccupied(string? seatStatesJson)
    {
        if (string.IsNullOrWhiteSpace(seatStatesJson)) return 0;
        var states = JsonSerializer.Deserialize<Dictionary<string, string>>(seatStatesJson);
        return states is null ? 0 : states.Values.Count(v => OccupiedStatuses.Contains(v));
    }

    public static int OpenSeats(int capacity, string? seatStatesJson)
        => Math.Max(0, capacity - CountOccupied(seatStatesJson));
}
