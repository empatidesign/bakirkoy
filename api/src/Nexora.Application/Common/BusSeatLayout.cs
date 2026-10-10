namespace Nexora.Application.Common;

public static class BusSeatLayout
{
    private record Template(int Rows, int Left, int Right, int Back);

    private static readonly Dictionary<string, Template> Templates = new()
    {
        ["intercity_2plus1_39"] = new(13, 1, 2, 4),
        ["tour_2plus2_44"] = new(11, 2, 2, 5),
        ["minibus_2plus1_20"] = new(6, 1, 2, 2),
        ["midibus_2plus2_30"] = new(7, 2, 2, 2),
        ["standard_2plus2_38"] = new(9, 2, 2, 2),
    };

    private record Seat(string Label, string Side, int Row, int Index);

    private static List<Seat> Build(string? templateId)
    {
        if (templateId is null || !Templates.TryGetValue(templateId, out var t)) return [];
        var seats = new List<Seat>();
        var counter = 1;
        for (var row = 1; row <= t.Rows; row++)
        {
            for (var i = 0; i < t.Left; i++) seats.Add(new Seat(counter++.ToString(), "L", row, i));
            for (var i = 0; i < t.Right; i++) seats.Add(new Seat(counter++.ToString(), "R", row, i));
        }
        for (var i = 0; i < t.Back; i++) seats.Add(new Seat(counter++.ToString(), "B", 0, i));
        return seats;
    }

    // Not (2026-09-27, uçtan uca gezi testi): TravelApplications.SeatNumber ve reserve isteğindeki
    // seatNumber alanı, vatandaşa gösterilen sayısal Seat.Label formatındadır (bkz. BuildSeatList/
    // CitizenTravelSeatDto — IdToLabel() üzerinden hep bu Label döndürülür). Bu metot da o formatla
    // çalışır; ID (SeatId) formatı yalnız SeatStatesJson (admin koltuk haritası) içinde kullanılır.
    public static HashSet<string> AdjacentLabels(string? templateId, string label)
    {
        var seats = Build(templateId);
        var target = seats.FirstOrDefault(s => s.Label == label);
        if (target is null) return [];

        return seats
            .Where(s => s.Label != label
                && s.Side == target.Side
                && s.Row == target.Row
                && Math.Abs(s.Index - target.Index) == 1)
            .Select(s => s.Label)
            .ToHashSet();
    }

    private static string SeatId(Seat s) => s.Side switch
    {
        "L" => $"L-{s.Row}-{s.Index}",
        "R" => $"R-{s.Row}-{s.Index}",
        _ => $"B-{s.Index}",
    };

    public static List<string> PassengerSeatIdsInOrder(string? templateId)
        => Build(templateId).Select(SeatId).ToList();

    public static Dictionary<string, string> LabelToId(string? templateId)
        => Build(templateId).ToDictionary(s => s.Label, SeatId);

    public static Dictionary<string, string> IdToLabel(string? templateId)
        => Build(templateId).ToDictionary(SeatId, s => s.Label);

    public static List<List<string>> AdjacencyIdSegments(string? templateId)
        => Build(templateId)
            .GroupBy(s => new { s.Side, s.Row })
            .Select(g => g.OrderBy(s => s.Index).Select(SeatId).ToList())
            .ToList();
}
