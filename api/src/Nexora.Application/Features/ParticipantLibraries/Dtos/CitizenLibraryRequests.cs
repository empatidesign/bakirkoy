namespace Nexora.Application.Features.ParticipantLibraries.Dtos;

public record CitizenLibraryDiscoverParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 20;
    public string? Search { get; init; }
    public string? AreaType { get; init; }
    public bool? OnlyAvailable { get; init; }
    /// <summary>İlçeye göre daraltma.</summary>
    public string? District { get; init; }
    /// <summary>Yalnızca yer ayırtılabilen kıraathaneler.</summary>
    public bool? OnlyReservable { get; init; }
    /// <summary>Erişim tipi: open | qr | device.</summary>
    public string? AccessType { get; init; }
    /// <summary>Oturma düzeni: masali | sirali.</summary>
    public string? SeatingMode { get; init; }
    /// <summary>Yalnızca sıra (kuyruk) sistemi açık olanlar.</summary>
    public bool? OnlyQueueEnabled { get; init; }
    /// <summary>Bu olanağa sahip olanlar (ör. wifi, cafe).</summary>
    public string? Amenity { get; init; }
}

public record CitizenLibraryReservationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 50;
    public string? Status { get; init; }
    // Kullanıcı isteği (2026-09-23): mobil "Genel Arama" ekranı giriş yapmış kullanıcının
    // kendi kütüphane rezervasyonları içinde de arama yapabilsin diye eklendi — kıraathane
    // adı üzerinden eşleşir (bkz. GetByParticipantAsync).
    public string? Search { get; init; }
}

public record CitizenLibraryReserveRequest(
    DateTime? SlotStart,
    DateTime? SlotEnd,
    string? Seat
);
