using Nexora.Domain.Entities.Travels;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class TravelCapacityTests
{
    private static TravelApplication BuildApplication(int extraPassengers)
    {
        var app = TravelApplication.Create(
            Guid.NewGuid(), Guid.NewGuid(), "pending", "pending", "pending",
            null, null, "", "GZB-000001", "Tester");

        app.AddPassenger(TravelApplicationPassenger.Create(app.Id, Guid.NewGuid(), "male", null, null, true));
        for (var i = 0; i < extraPassengers; i++)
            app.AddPassenger(TravelApplicationPassenger.Create(app.Id, Guid.NewGuid(), "female", null, null, false));

        return app;
    }

    private static int SeatDemand(TravelApplication app) => Math.Max(app.Passengers.Count, 1);

    [Fact]
    public void Tek_yolculu_basvuru_bir_kontenjan_talep_eder()
    {
        Assert.Equal(1, SeatDemand(BuildApplication(extraPassengers: 0)));
    }

    [Fact]
    public void Ek_yolcular_kontenjan_talebine_dahil_edilir()
    {
        Assert.Equal(3, SeatDemand(BuildApplication(extraPassengers: 2)));
    }

    [Fact]
    public void Misafir_ayri_basvuru_satiri_oldugu_icin_tek_kontenjan_talep_eder()
    {
        var guest = TravelApplication.CreateGuest(
            Guid.NewGuid(), Guid.NewGuid(),
            "Misafir Kişi", "10000000146", new DateTime(1990, 1, 1), "5550000000", "a@b.com", "female",
            null, null, "GZB-000002", "Tester");

        Assert.Equal(1, SeatDemand(guest));
    }

    private static bool CreateAsilir(int capacity, int approved, int pending, int seatDemand)
        => capacity > 0 && approved + pending + seatDemand > capacity;

    [Fact]
    public void Create_dolu_gezide_kontenjani_asar()
    {
        Assert.True(CreateAsilir(capacity: 2, approved: 2, pending: 0, seatDemand: 1));
    }

    [Fact]
    public void Create_kontenjani_tam_dolduran_basvuruya_izin_verir()
    {
        Assert.False(CreateAsilir(capacity: 2, approved: 1, pending: 0, seatDemand: 1));
    }

    [Fact]
    public void Create_bekleyen_basvurulari_da_kontenjandan_sayar()
    {
        Assert.True(CreateAsilir(capacity: 3, approved: 1, pending: 2, seatDemand: 1));
    }

    [Fact]
    public void Create_sinirsiz_kontenjanda_engellemez()
    {
        Assert.False(CreateAsilir(capacity: 0, approved: 500, pending: 500, seatDemand: 10));
    }
}
