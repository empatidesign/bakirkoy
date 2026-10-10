using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.ParticipantSubmissions.Dtos;

public record CitizenSubmissionFormOptionsDto(
    IReadOnlyList<CitizenSubmissionOptionDto> Categories,
    IReadOnlyList<CitizenSubmissionOptionDto> Types,
    IReadOnlyList<CitizenSubmissionOptionDto> Priorities,
    IReadOnlyList<CitizenSubmissionOptionDto> Neighborhoods,
    // Kullanıcı isteği (2026-08-28): adres ikametgah mı farklı mı + mahalle/ilçe kapsamı seçimi.
    IReadOnlyList<CitizenSubmissionOptionDto> AddressTypes,
    IReadOnlyList<CitizenSubmissionOptionDto> Scopes,
    // Vatandaşın ikametgah bilgisi: form otomatik doldurulabilsin diye.
    string? ResidenceNeighborhood = null,
    string? ResidenceAddress = null,
    string? ResidenceDistrict = null);

/// <summary>
/// Kullanıcı isteği (2026-08-28): "başvurusunun durumunu sorgulayabilir ... tüm süreler
/// anlatılacak". Başvurunun zaman çizelgesindeki tek bir adım.
/// </summary>
public record SubmissionTimelineItemDto(
    string EventType,
    string EventLabel,
    string Status,
    string Title,
    string? Note,
    string ActorType,
    DateTime OccurredAt,
    double? HoursSincePrevious);

public record CitizenSubmissionMeDto(
    Guid Id,
    string? TrackingNo,
    string Title,
    string Description,
    string CategoryId,
    string CategoryLabel,
    string SubmissionType,
    /// <summary>
    /// Hata raporu (docs/hata.md #4.1): tür kullanıcıya "Request/Complaint/Suggestion" diye
    /// İngilizce görünüyordu. Ham enum istemciye lazım (filtre/mantık), ama gösterilecek metin
    /// artık Status'ta olduğu gibi sunucudan geliyor — her istemci kendi sözlüğünü tutup
    /// eksik kaldığında ham değeri ekrana basamaz.
    /// </summary>
    string SubmissionTypeLabel,
    string Priority,
    /// <summary>Hata raporu (docs/hata.md #4.2): öncelik metni de tek kaynaktan gelir.</summary>
    string PriorityLabel,
    double? Latitude,
    double? Longitude,
    string Neighborhood,
    string Address,
    string AddressType,
    string Scope,
    string Status,
    string StatusLabel,
    DateTime SubmittedAt,
    DateTime? ForwardedAt,
    DateTime? ResolvedAt,
    IReadOnlyList<string> MediaUrls,
    string? RoutedUnit,
    string? UlakbelTrackingNo,
    string? ResolutionNote,
    double? ElapsedHours,
    /// <summary>
    /// Hata raporu (docs/hata.md #4.4): düzenleme kısıtı sunucuda belirlenir, istemci kendi
    /// kuralını uydurmaz — buton yalnızca gerçekten güncellenebilen kayıtlarda görünür.
    /// </summary>
    bool CanEdit,
    IReadOnlyList<SubmissionTimelineItemDto> Timeline);

/// <summary>
/// Hata raporu (docs/hata.md #4.4): vatandaşın kendi başvurusunu düzenlemesi. Konum/adres
/// bilgisi bilinçli olarak dışarıda: adres ikametgahtan türetiliyor ve başvuru zaten ilgili
/// mahalleye yönlendirilmiş durumda.
/// </summary>
public record UpdateCitizenSubmissionMeRequest(
    string Title,
    string Description,
    string SubmissionType,
    string Priority);

public record CreateCitizenSubmissionMeRequest(
    string Title,
    string Description,
    string CategoryId,
    string SubmissionType,
    string Priority,
    string Neighborhood,
    string Address,
    double? Latitude,
    double? Longitude,
    bool NotifyMuhtar,
    string? ComplaintReason,
    IReadOnlyList<string>? MediaUrls,
    // Kullanıcı isteği (2026-08-28)
    string? AddressType = "residence",
    string? Scope = "neighborhood");

public record SubmissionMediaUploadDto(string Url, string ObjectName, long SizeBytes);

public record CitizenSubmissionMeListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
