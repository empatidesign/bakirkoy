namespace Nexora.Application.Features.Reports.Dtos;

public record ReportsOverviewParams
{
    public string? Preset { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Module { get; init; }
}

public record ReportsRangeDto(string Preset, DateTime From, DateTime To, DateTime PrevFrom, DateTime PrevTo);

public record ReportsKpiDto(string Key, string Label, int Current, int Previous, double DeltaPct);

public record ReportsModuleStatDto(
    string Module,
    string Label,
    int TotalApplications,
    int Approved,
    int Pending,
    int Waitlisted,
    int Rejected,
    int UniquePeople,
    int PreviousTotal,
    double DeltaPct);

public record ReportsTrendPointDto(string Date, Dictionary<string, int> Values, int Total);

public record ReportsTopItemDto(
    string Module,
    string ModuleLabel,
    string Name,
    string? SubLabel,
    int Applications,
    int Approved,
    int Capacity,
    int FillRate,
    double AvgRating,
    int ReviewCount);

public record ReportsTopParticipantDto(
    Guid? ParticipantId,
    string FullName,
    string? Tckn,
    int TotalParticipations,
    Dictionary<string, int> ModuleBreakdown,
    DateTime LastActivityAt,
    string? LastActivityName,
    string? LastActivityModuleLabel);

public record ReportsGenderSliceDto(int Male, int Female, int Unknown);

public record ReportsAgeBucketDto(string Bucket, int Count);

public record ReportsNationalityDto(int Turkish, int Foreign, int Unknown);

public record ReportsStatusBreakdownDto(string Status, string Label, int Count);

public record ReportsAttendanceStatDto(
    string Module,
    string Label,
    int TotalSessions,
    int Present,
    int Absent,
    int Late,
    double AttendanceRate);

public record ReportsRatingDto(double Average, List<int> Distribution, int TotalReviews);

public record ReportsOverviewDto(
    ReportsRangeDto Range,
    List<ReportsKpiDto> Kpis,
    List<ReportsModuleStatDto> Modules,
    List<ReportsTrendPointDto> Trend,
    List<ReportsTopItemDto> TopDemand,
    List<ReportsTopItemDto> TopRated,
    List<ReportsTopParticipantDto> TopParticipants,
    ReportsGenderSliceDto Gender,
    List<ReportsAgeBucketDto> AgeBuckets,
    ReportsNationalityDto Nationality,
    List<ReportsStatusBreakdownDto> StatusBreakdown,
    List<ReportsAttendanceStatDto> Attendance,
    ReportsRatingDto Rating);

public record ReportsParticipantDetailParams
{
    public string? Preset { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public record ReportsParticipantActivityDto(
    string Module,
    string ModuleLabel,
    string ItemName,
    DateTime Date,
    string Status,
    string StatusLabel);

public record ReportsParticipantActivitySummaryDto(
    string Module,
    string ModuleLabel,
    string ItemName,
    int Count,
    DateTime LastAt,
    DateTime FirstAt);

public record ReportsParticipantDetailDto(
    Guid? ParticipantId,
    string FullName,
    string? Tckn,
    string? Phone,
    int TotalParticipations,
    Dictionary<string, int> ModuleBreakdown,
    List<ReportsParticipantActivityDto> Activities,
    List<ReportsParticipantActivitySummaryDto> ActivitySummary);
