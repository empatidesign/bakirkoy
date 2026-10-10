namespace Nexora.Application.Features.ParticipantTravels.Dtos;

public record CitizenTravelDiscoverParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CategoryId { get; init; }
}

public record CitizenTravelApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Scope { get; init; }
    public string? Status { get; init; }
    public string? Period { get; init; }
    // Kullanıcı isteği (2026-09-23): mobil "Genel Arama" ekranı giriş yapmış kullanıcının
    // kendi gezi başvuruları içinde de arama yapabilsin diye eklendi — gezi adı/hedef/güzergah
    // üzerinden eşleşir (bkz. GetByParticipantsAsync).
    public string? Search { get; init; }
}

public record CitizenTravelGuestLookupRequest(string Tckn, DateTime BirthDate);

public record CitizenTravelReserveGuest(
    string Tckn,
    DateTime? BirthDate,
    string Phone,
    string Email);

public record CitizenTravelReservePassenger(
    Guid? ParticipantId,
    string? SeatNumber,
    CitizenTravelReserveGuest? Guest);

public record CitizenTravelReserveRequest(
    Guid? BusId,
    List<CitizenTravelReservePassenger>? Passengers);
