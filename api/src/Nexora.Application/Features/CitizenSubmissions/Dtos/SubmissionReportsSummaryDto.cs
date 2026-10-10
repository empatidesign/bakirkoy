namespace Nexora.Application.Features.CitizenSubmissions.Dtos;

public record SubmissionDistributionItemDto(string Key, string Label, int Count);

public record SubmissionTrendPointDto(string Date, int Count);

public record NeighborhoodBreakdownItemDto(
    string Neighborhood,
    int Total,
    int Complaints,
    int Requests,
    int Suggestions,
    int Urgent,
    int Resolved,
    IReadOnlyList<SubmissionDistributionItemDto> TopCategories);

/// <summary>
/// Kullanıcı isteği (2026-08-08): "çok iyi bir istatistik istiyorum" — muhtar/mahalle bazlı
/// performans karşılaştırması. AvgResolutionDays sadece o mahallede çözülmüş kayıtların
/// ortalama çözüm süresidir (NaN/0 olabilir, veri yoksa 0 döner); PendingCount o mahallenin
/// hâlâ bekleyen (yeni + incelemede) kayıt sayısıdır.
/// </summary>
public record MuhtarPerformanceItemDto(
    string Neighborhood,
    int Total,
    int ResolvedCount,
    double AvgResolutionDays,
    int PendingCount,
    double ResolutionRate);

/// <summary>Saatlik/haftanın günü yoğunluk noktası — Türkiye saatine göre hesaplanır.</summary>
public record SubmissionHeatmapPointDto(int DayOfWeek, int Hour, int Count);

public record SubmissionReportsSummaryDto(
    double AvgResolutionDays,
    int ResolvedCount,
    int UlakbelForwarded,
    int UlakbelEligible,
    double UlakbelRate,
    double ResolutionRate,
    int Pending,
    IReadOnlyList<SubmissionDistributionItemDto> ByCategory,
    IReadOnlyList<SubmissionDistributionItemDto> ByNeighborhood,
    IReadOnlyList<SubmissionDistributionItemDto> ByType,
    IReadOnlyList<SubmissionDistributionItemDto> ByPriority,
    IReadOnlyList<SubmissionDistributionItemDto> ByStatus,
    IReadOnlyList<SubmissionTrendPointDto> Trend,
    IReadOnlyList<NeighborhoodBreakdownItemDto> NeighborhoodBreakdown,
    // Kullanıcı isteği (2026-08-08) — genişletilmiş istatistikler:
    IReadOnlyList<SubmissionDistributionItemDto> ByChannel,
    double AvgForwardHours,
    IReadOnlyList<SubmissionTrendPointDto> Trend30d,
    IReadOnlyList<MuhtarPerformanceItemDto> MuhtarPerformance,
    IReadOnlyList<SubmissionDistributionItemDto> ByComplaintReason,
    IReadOnlyList<SubmissionHeatmapPointDto> Heatmap,
    // Kullanıcı isteği (2026-09-07): "genel talepler bölümünde de detaylı bir dashboard'da
    // muhtarlıkların tüm sorunları, en çok talep, en çok şikayet edilen konular vs gibi
    // genel bir dashboard olsun" — kategori kırılımını başvuru TÜRÜNE göre ayırır ki
    // "en çok şikayet edilen konu" ile "en çok talep edilen konu" farklı listeler olsun
    // (toplam ByCategory ikisini karıştırıp yanıltıcı bir sıralama üretiyordu).
    IReadOnlyList<SubmissionDistributionItemDto> ByCategoryComplaint,
    IReadOnlyList<SubmissionDistributionItemDto> ByCategoryRequest);
