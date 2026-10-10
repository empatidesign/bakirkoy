using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CategoryId { get; init; }
    public Guid? RouteId { get; init; }
    public bool? IsActive { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    /// <summary>Kullanıcı isteği (2026-08-07): "pasif geziler süresi geçmiş gezileri göstermesin"
    /// — true ise bitiş tarihi geçmiş (EndDate &lt; bugün) seferler listeden çıkarılır. Frontend
    /// varsayılan olarak true gönderir; kullanıcı "Geçmiş Seferleri Göster" açarsa false gönderir.</summary>
    public bool? HidePast { get; init; }
}

public record TravelFormRequest(
    Guid RouteId,
    DateTime StartDate,
    DateTime EndDate,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    int Capacity,
    int ReserveCapacity,
    string ParticipationPeriod,
    int ParticipationLimit,
    bool ExemptFromParticipationLimit,
    int CancellationDeadlineHours,
    JsonElement Crew,
    List<Guid> BusIds,
    bool IsActive
);

/// <summary>
/// Sefer kopyalama isteği. Route'a bağlı tüm içerik (isim, açıklama, kural, görsel,
/// fiyat, kısıtlar) kaynak seferden aynen miras alınır; yalnızca tarihler ve
/// isteğe bağlı olarak otobüs ataması (aynı havuz aracı ya da çoğaltılmış özel kopya) değişir.
/// </summary>
public record TravelCopyRequest(
    DateTime StartDate,
    DateTime EndDate,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    bool CloneBuses
);

/// <summary>
/// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme kopyalama" — tek bir sefer kaydından,
/// her biri kendi tarih/kayıt aralığına sahip BİRDEN FAZLA yeni sefer tek işlemde oluşturulabilir
/// (ör. aynı geziyi 3 farklı hafta sonu için tekrar açmak). Her hedef kendi bağımsız
/// TravelCopyRequest'i kadar bilgi taşır; FacilityGroup'un CopyToFacilitiesAsync'iyle aynı
/// "best-effort, kısmi başarı" deseni izlenir — bir hedef başarısız olursa diğerleri etkilenmez.
/// </summary>
public record TravelBulkCopyRequest(List<TravelCopyRequest> Targets);

public record TravelBulkCopyItemResult(int Index, bool Success, Guid? TravelId, string? Code, string? Error);

public record TravelBulkCopyResult(List<TravelBulkCopyItemResult> Results);
