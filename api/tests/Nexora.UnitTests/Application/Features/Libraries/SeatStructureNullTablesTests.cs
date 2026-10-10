using Nexora.Application.Features.Libraries.Dtos;
using Xunit;

namespace Nexora.UnitTests.Application.Features.Libraries;

// REGRESYON — BULGU 2026-10-02 (derinlemesine modül testi, kütüphane seat-plan canlı akışı):
// `SeatStructure.SectionUsed` eskiden `section.Tables.Sum(...)` çağırıyordu. `Tables` null
// geldiğinde (admin panelden "masalı" bir bölüm henüz masa eklenmeden kaydedilirse, LayoutJson'da
// `{"tables": null, "capacity": 0}` olarak saklanır) bu çağrı NullReferenceException fırlatıyor,
// `GET /me/libraries/{id}/seat-plan` o kıraathane için her zaman 500 dönüyordu — vatandaş
// rezervasyon ekranını hiç açamıyordu (canlı denetimde 16 masalı kıraathanenin 8'i etkilenmişti).
// Düzeltme (commit 45be927, bu çalışmada bağımsız doğrulandı): `(section.Tables ?? []).Sum(...)`.
public class SeatStructureNullTablesTests
{
    private static LibrarySectionDto Section(List<LibraryTableDto>? tables, int capacity = 0)
        => new("sec-1", "A Bölümü", "table", "#fff", capacity, tables!);

    [Fact]
    public void TablesNullIkenSectionUsedPatlamazSifirDoner()
    {
        var section = Section(tables: null);

        var used = SeatStructure.SectionUsed(section);

        Assert.Equal(0, used);
    }

    [Fact]
    public void TablesNullIkenSectionCapacityPatlamazAyarliKapasiteyiDoner()
    {
        var section = Section(tables: null, capacity: 12);

        var capacity = SeatStructure.SectionCapacity(section);

        Assert.Equal(12, capacity);
    }

    [Fact]
    public void TablesDoluIkenGercekToplamıDogruHesaplar()
    {
        var section = Section(tables: new List<LibraryTableDto>
        {
            new("t1", "Masa 1", 4),
            new("t2", "Masa 2", 2),
        });

        var used = SeatStructure.SectionUsed(section);

        Assert.Equal(6, used);
    }

    [Fact]
    public void FloorAllocatedTablesNullOlanBolumleriIcerenKattaPatlamaz()
    {
        var floor = new LibraryFloorDto("f1", "Zemin Kat", Capacity: 0, Active: true, AutoOpenWhenPreviousFull: false,
            Sections: new List<LibrarySectionDto>
            {
                Section(tables: null, capacity: 10),
                Section(tables: new List<LibraryTableDto> { new("t1", "Masa 1", 5) }),
            });

        var allocated = SeatStructure.FloorAllocated(floor);

        Assert.Equal(15, allocated);
    }
}
