namespace Nexora.Application.Features.Analytics.Dtos;


public record RecentMemberDto(
    Guid Id,
    string FullName,
    string? Phone,
    string? District,
    DateTime RegisteredAt);

public record RecentEventDto(
    Guid Id,
    string Name,
    string CategoryLabel,
    DateTime StartDate,
    int ApplicationCount,
    int Capacity);

public record RecentLoginDto(
    Guid? UserId,
    string UserName,
    string UserType,
    string Action,
    DateTime OccurredAt,
    string? IpAddress);

public record RecentApplicationDto(
    string Module,
    string ModuleLabel,
    Guid Id,
    string ApplicantName,
    string? TargetName,
    string Status,
    DateTime CreatedAt);

public record ModuleRecordSummaryDto(
    string Module,
    string Label,
    int TotalRecords,
    int TodayRecords);

public record LibraryGlobalSummaryDto(
    int TotalLibraries,
    int ActiveLibraries,
    int TotalCapacity,
    int CurrentOccupancy,
    int OnBreakNow,
    int WaitingNow,
    double OccupancyRate,
    int VisitsToday,
    int VisitsThisMonth,
    double AvgSessionMinutesThisMonth);

public record GlobalStatsDto(
    int TotalParticipants,
    int NewParticipantsToday,
    int NewParticipantsThisWeek,
    int NewParticipantsThisMonth,
    int TotalEvents,
    int ActiveEvents,
    int EventsThisMonth,
    LibraryGlobalSummaryDto? Library);

public record DashboardActivityDto(
    List<RecentMemberDto> RecentMembers,
    List<RecentEventDto> RecentEvents,
    List<RecentLoginDto> RecentLogins,
    List<RecentApplicationDto> RecentApplications,
    List<ModuleRecordSummaryDto> ModuleSummaries,
    GlobalStatsDto GlobalStats);

/// <summary>
/// Online kullanıcı özeti. Kullanıcı isteği (2026-09-07): "toplam kaç kişi online
/// olmuş" bilgisi panelde dashboard'da gösterilsin.
/// </summary>
/// <param name="Total">Son 5 dakikada aktif benzersiz kullanıcı sayısı.</param>
/// <param name="PeakToday">Bugünkü en yüksek eşzamanlı online sayısı (5 dk'lık kayıtlardan).</param>
/// <param name="Trend">Son saatlerin 5 dakikalık ölçümleri (grafik için, eskiden yeniye).</param>
public record OnlineUsersDto(
    int Total,
    int Admin,
    int Citizen,
    int Company,
    int PeakToday,
    List<OnlineTrendPointDto> Trend,
    int CitizenIos,
    int CitizenAndroid,
    int CitizenWeb);

public record OnlineTrendPointDto(DateTime CapturedAt, int Total);
