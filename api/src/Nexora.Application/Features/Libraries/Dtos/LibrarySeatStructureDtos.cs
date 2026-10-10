namespace Nexora.Application.Features.Libraries.Dtos;

public record LibrarySectionDto(string Id, string Name, string Type, string Color, int Capacity, List<LibraryTableDto> Tables);

public record LibraryTableDto(string Id, string Name, int SeatCount);

public record SeatStructureRequest(bool IsMultiFloor, List<LibraryFloorDto> Floors);

public record SeatSectionDto(string Id, string Name, string Type, string Color, int Capacity, List<SeatTableDto> Tables);

public record SeatTableDto(string Id, string Name, int SeatCount, int Occupied, List<SeatDto> Seats);

public static class SeatStructure
{
    // Bulgu (2026-10-02): Tables null geldiğinde (section henüz masa eklenmemiş,
    // ör. LayoutJson'da "tables": null) section.Tables.Sum(...) NullReferenceException
    // fırlatıyordu — GET seat-plan ucu "masali" kıraathanelerde (herhangi bir bölümünde
    // boş masa listesi varsa) hep 500 dönüyordu, vatandaş rezervasyon ekranını hiç açamıyordu.
    public static int SectionUsed(LibrarySectionDto section) =>
        (section.Tables ?? []).Sum(t => Math.Max(0, t.SeatCount));

    public static int SectionCapacity(LibrarySectionDto section)
        => section.Capacity > 0 ? section.Capacity : SectionUsed(section);

    public static int FloorAllocated(LibraryFloorDto floor)
        => floor.Sections is { Count: > 0 } ? floor.Sections.Sum(SectionCapacity) : 0;

    public static int FloorCapacity(LibraryFloorDto floor) => Math.Max(0, floor.Capacity);

    public static int TotalCapacity(IEnumerable<LibraryFloorDto> floors)
        => floors.Where(f => f.Active).Sum(FloorCapacity);
}
