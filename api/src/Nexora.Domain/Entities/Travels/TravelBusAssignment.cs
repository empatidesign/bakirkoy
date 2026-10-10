namespace Nexora.Domain.Entities.Travels;

public class TravelBusAssignment
{
    public Guid TravelId { get; set; }
    public Guid BusId { get; set; }
    public string? SeatStatesJson { get; set; }
}
