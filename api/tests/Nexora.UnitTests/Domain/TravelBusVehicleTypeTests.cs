using Nexora.Domain.Entities.Travels;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class TravelBusVehicleTypeTests
{
    [Fact]
    public void Create_gecerli_capacity_tipiyle_dogru_alanlari_ayarlar()
    {
        var bus = TravelBus.Create("Boğaz Vapuru", "", "capacity", "", 150, "{}", 0, "yakup");

        Assert.Equal("capacity", bus.VehicleType);
        Assert.True(bus.IsCapacityOnly);
        Assert.Equal(150, bus.Capacity);
        Assert.Equal(string.Empty, bus.TemplateId);
        Assert.Equal(0, bus.OccupiedCount);
    }

    [Fact]
    public void Create_gecersiz_vehicleType_bus_a_dusurur()
    {
        var bus = TravelBus.Create("Test", "34 ABC 1", "bilinmeyen-tur", "intercity_2plus1_39", 43, "{}", 0, null);

        Assert.Equal("bus", bus.VehicleType);
        Assert.False(bus.IsCapacityOnly);
    }

    [Fact]
    public void Create_vehicleType_verilmezse_varsayilan_bus_olur_geriye_donuk_uyum()
    {
        var bus = TravelBus.Create("Servis Otobüsü", "34 XYZ 2", "bus", "tour_2plus2_44", 49, "{}", 0, null);

        Assert.Equal("bus", bus.VehicleType);
        Assert.False(bus.IsCapacityOnly);
        Assert.Equal("tour_2plus2_44", bus.TemplateId);
    }

    [Fact]
    public void Update_capacity_tipine_gecince_TemplateId_temizlenir_ve_Capacity_dogrudan_kullanilir()
    {
        var bus = TravelBus.Create("Otobüs", "34 A 1", "bus", "intercity_2plus1_39", 43, "{}", 5, null);

        bus.Update("Boğaz Vapuru", "", "capacity", "", 200, "{}", bus.OccupiedCount);

        Assert.True(bus.IsCapacityOnly);
        Assert.Equal(200, bus.Capacity);
        Assert.Equal(string.Empty, bus.TemplateId);
        Assert.Equal(5, bus.OccupiedCount);
    }

    [Fact]
    public void SetOccupiedCount_negatif_degeri_sifira_kirpar()
    {
        var bus = TravelBus.Create("Vapur", "", "capacity", "", 100, "{}", 0, null);

        bus.SetOccupiedCount(-3);

        Assert.Equal(0, bus.OccupiedCount);
    }

    [Fact]
    public void Create_negatif_capacity_sifira_kirpilir()
    {
        var bus = TravelBus.Create("Vapur", "", "capacity", "", -10, "{}", 0, null);

        Assert.Equal(0, bus.Capacity);
    }
}
