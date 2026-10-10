using Nexora.Application.Features.ParticipantSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "muhtar dashboard'da çok detaylı bütün ekranların listelenmesi
/// olacak ... ana dashboard'da hangi konularda hangi mahallelerde şikayetler var ... tüm süreci
/// muhtarın görmesi gerek ... kimin gönderdiği isim vs görünmeyecek".
///
/// Bu DTO tek çağrıda muhtar panelinin ana ekranını besler. İçinde HİÇBİR kişisel veri
/// (ad, TC, telefon) yoktur — yalnızca konu, mahalle, durum, süre ve sayı bilgileri vardır.
/// </summary>
public record MuhtarDashboardDto(
    IReadOnlyList<string> Neighborhoods,
    MuhtarDashboardTotalsDto Totals,
    MuhtarDashboardTimingsDto Timings,
    IReadOnlyList<SubmissionDistributionItemDto> TopCategories,
    IReadOnlyList<SubmissionDistributionItemDto> ByType,
    IReadOnlyList<SubmissionDistributionItemDto> ByStatus,
    IReadOnlyList<SubmissionDistributionItemDto> ByPriority,
    IReadOnlyList<SubmissionDistributionItemDto> ByScope,
    IReadOnlyList<SubmissionDistributionItemDto> ByAddressType,
    IReadOnlyList<SubmissionDistributionItemDto> ByRoutedUnit,
    IReadOnlyList<SubmissionTrendPointDto> Trend30d,
    IReadOnlyList<MuhtarNeighborhoodStatDto> NeighborhoodStats,
    IReadOnlyList<MuhtarPipelineStageDto> Pipeline,
    IReadOnlyList<MuhtarRecentItemDto> Recent,
    IReadOnlyList<MuhtarRecentItemDto> Overdue);

public record MuhtarDashboardTotalsDto(
    int Total,
    int New,
    int InReview,
    int Forwarded,
    int Resolved,
    int Rejected,
    int Urgent,
    int Open,
    int Last7Days,
    int Last30Days,
    int CreatedByMuhtar);

/// <summary>
/// Süreç süreleri (saat). Kullanıcı isteği (2026-08-28): "bilimsel bilgi tüm süreler anlatılacak".
/// </summary>
public record MuhtarDashboardTimingsDto(
    double AvgFirstResponseHours,
    double AvgForwardHours,
    double AvgResolutionHours,
    double MedianResolutionHours,
    double ResolutionRate,
    int OverdueCount,
    int OnTimeResolvedCount,
    double SlaComplianceRate);

public record MuhtarNeighborhoodStatDto(
    string Neighborhood,
    int Total,
    int Open,
    int Resolved,
    int Urgent,
    double AvgResolutionHours,
    double ResolutionRate,
    IReadOnlyList<SubmissionDistributionItemDto> TopCategories,
    // Kullanıcı isteği (2026-09-07): "/muhtarlik?tab=muhtarlar sayfasında her mahallenin
    // kaç talep/istek/şikayet aldığı, kaçının çözüldüğü görünsün" — admin, muhtar
    // detayına girmeden mahalle bazında tip kırılımını (talep/istek-öneri/şikayet)
    // tek bakışta görebilsin diye eklendi.
    int RequestCount,
    int SuggestionCount,
    int ComplaintCount);

/// <summary>Süreç hunisi: her aşamada kaç kayıt var ve o aşamada ortalama ne kadar bekleniyor.</summary>
public record MuhtarPipelineStageDto(
    string Stage,
    string Label,
    int Count,
    double AvgHoursInStage);

/// <summary>
/// Muhtar listeleri için ANONİM kayıt özeti. Vatandaş adı/TC/telefonu asla yer almaz;
/// <see cref="ContentVisible"/> false ise (metinde kişiye yönelik ifade tespit edilmişse)
/// başlık/açıklama yerine yalnızca konu başlığı gösterilir.
/// </summary>
public record MuhtarRecentItemDto(
    Guid Id,
    string? TrackingNo,
    string Neighborhood,
    string CategoryId,
    string CategoryLabel,
    string SubmissionType,
    string TypeLabel,
    string Priority,
    string Status,
    string StatusLabel,
    string Scope,
    string AddressType,
    DateTime SubmittedAt,
    DateTime? ForwardedAt,
    DateTime? ResolvedAt,
    double ElapsedHours,
    double SlaTargetHours,
    bool IsOverdue,
    string? RoutedUnit,
    bool ContentVisible,
    string? Title,
    string? Description,
    string SubmittedVia);

/// <summary>Muhtarın tek bir kayıt için gördüğü anonim süreç detayı.</summary>
public record MuhtarSubmissionDetailDto(
    MuhtarRecentItemDto Summary,
    string? ResolutionNote,
    IReadOnlyList<SubmissionTimelineItemDto> Timeline);

/// <summary>Muhtarın bir kayda kendi görüşünü (olumlu/olumsuz) eklemesi.</summary>
public record MuhtarOpinionRequest(string Opinion, string? Note);
