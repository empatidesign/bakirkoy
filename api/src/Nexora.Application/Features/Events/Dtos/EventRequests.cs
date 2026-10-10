using System.Text.Json;

namespace Nexora.Application.Features.Events.Dtos;

public record EventListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CategoryId { get; init; }
    public Guid? FacilityId { get; init; }
    public Guid? HallId { get; init; }
    public bool? IsActive { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    // Kullanıcı isteği (2026-08-11): gezi/travels modülündeki HidePast deseniyle aynı — true ise
    // bitiş tarihi geçmiş etkinlikler listeden çıkarılır. Vatandaş "discover" akışı bu alanı
    // göndermediği için (null) davranışı değişmez.
    public bool? HidePast { get; init; }
}

public record EventFormRequest(
    string Name,
    Guid CategoryId,
    string VenueType,
    Guid? FacilityId,
    Guid? HallId,
    EventLocationDto? Location,
    DateTime StartDate,
    DateTime EndDate,
    bool IsSingleDay,
    string Gender,
    int Capacity,
    int ReserveCapacity,
    int MinAge,
    int MaxAge,
    string ParticipationPeriod,
    int ParticipationLimit,
    string Description,
    string InternalNote,
    JsonElement Images,
    EventAccessConfigDto Access,
    JsonElement Pricing,
    JsonElement Points,
    bool IsActive,
    bool SultangaziResidentOnly = false,
    string? StartTime = null,
    string? EndTime = null,
    string? ResidencyMode = null,
    DateTime? ApplicationStartDate = null,
    DateTime? ApplicationEndDate = null,
    // Kullanıcı isteği (2026-09-20): Etkinlik Sorumlusu ataması — TravelFormRequest.Crew ile
    // aynı desen (JsonElement, opsiyonel). EventService.GrantResponsibleAccessAsync bunu okur.
    JsonElement? Responsible = null
);

/// <summary>
/// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — Travel/FacilityGroup
/// modüllerindeki çoklu kopyalama deseninin Etkinlik karşılığı. Tek bir etkinlikten, her biri
/// kendi tarih aralığına sahip BİRDEN FAZLA bağımsız etkinlik kopyası tek işlemde oluşturulur
/// (ör. aynı seminer formatını 3 farklı tarihte tekrar açmak). Diğer tüm alanlar (isim, mekan,
/// kontenjan, erişim ayarları, görseller, fiyatlandırma) kaynaktan aynen miras alınır — yalnızca
/// tarih (ve varsa başvuru tarihi) hedefe özeldir.
/// </summary>
public record EventBulkCopyTarget(DateTime StartDate, DateTime EndDate, DateTime? ApplicationStartDate = null, DateTime? ApplicationEndDate = null);

public record EventBulkCopyRequest(List<EventBulkCopyTarget> Targets);

public record EventBulkCopyItemResult(int Index, bool Success, Guid? EventId, string? Code, string? Error);

public record EventBulkCopyResult(List<EventBulkCopyItemResult> Results);
