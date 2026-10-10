namespace Nexora.Application.Features.Travels.Dtos;

public record TravelBoardingPassengerDto(
    Guid ApplicationId,
    string Code,
    string PersonName,
    string? SeatNumber,
    string? BusName,
    string Status
);

public record TravelBoardingBusDto(
    Guid BusId,
    string BusName,
    string PlateNumber,
    int TotalPassengers,
    List<TravelBoardingPassengerDto> Passengers
);

public record TravelBoardingParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 50;
    public Guid? BusId { get; init; }
    public string? Search { get; init; }
}
