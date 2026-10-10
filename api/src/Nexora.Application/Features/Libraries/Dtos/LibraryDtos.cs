namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryFloorDto(string Id, string Name, int Capacity, bool Active, bool AutoOpenWhenPreviousFull, string? KrokiUrl = null, List<LibrarySectionDto>? Sections = null);

public record LibraryDto(
    Guid Id,
    string Name,
    string? Description,
    string? ImageUrl,
    Guid ServiceFacilityId,
    string? ServiceFacilityName,
    string? District,
    string? City,
    string? Address,
    int Capacity,
    int CurrentOccupancy,
    int WaitingCount,
    int OnBreakCount,
    int FloorCount,
    bool QueueEnabled,
    bool ReservationEnabled,
    bool DeviceControlEnabled,
    string AccessType,
    string? DeviceKind,
    string EntryControlMode,
    string ExitControlMode,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerRoleKey,
    string? ManagerRoleName,
    string? ManagerPhone,
    bool IsActive,
    DateTime CreatedAt,
    bool IsMultiFloor,
    List<LibraryFloorDto> Floors,
    string AreaType = "mixed",
    List<string>? Amenities = null,
    bool IpRestrictionEnabled = false,
    List<string>? AllowedIps = null,
    bool GeofenceEnabled = false,
    double? GeofenceLatitude = null,
    double? GeofenceLongitude = null,
    int GeofenceRadiusMeters = 150,
    string? OperationTemplate = null,
    string SeatingMode = "masali",
    bool BreakSystemEnabled = true,
    int AutoCheckOutAfterMinutes = 0,
    string ResidencyMode = "anyone");

public record LibraryOptionDto(string Value, string Label, string? District = null, string? City = null);

public record LibraryOverviewSummaryDto(
    int TotalLibraries,
    int ActiveLibraries,
    int PassiveLibraries,
    int TotalCapacity,
    int TotalOccupancy,
    int TotalOnBreak,
    int TotalWaiting,
    int OccupancyRate);

public record LibraryDetailSummaryDto(
    int Capacity,
    int CurrentOccupancy,
    int OccupancyRate,
    int WaitingCount,
    int OnBreakCount,
    int ViolationsCount);

public record LibraryAnalyticsParams(
    DateTime? From,
    DateTime? To,
    Guid? LibraryId
);

public record LibraryAnalyticsDto(
    int ActiveNow,
    int OnBreakNow,
    int WaitingNow,
    double OccupancyRateNow,
    int TotalVisits,
    double AvgDailyVisits,
    double AvgSessionMinutes,
    double AvgBreaksPerSession,
    double? AvgAge,
    int Under18Count,
    int Age18to25Count,
    int Age26to35Count,
    int Age36to50Count,
    int Over50Count,
    int MaleCount,
    int FemaleCount,
    List<TopLibraryDto> TopLibraries,
    List<TopUserDto> TopUsers,
    List<TopUserByHoursDto> TopUsersByHours,
    int TotalBreaks,
    double BreakRatePct,
    List<HourlyLoadDto> HourlyLoad,
    // Kullanıcı isteği (2026-10-05): eski (2019-2026) MySQL tabanlı Millet Kıraathanesi
    // sisteminden içe aktarılmış, TÜM ZAMANLARA ait (dönem filtresinden bağımsız) kullanım
    // geçmişi — LibraryLegacyUsageStats tablosundan gelir, bkz. o entity'nin yorumu.
    List<LegacyTopUserDto> LegacyTopUsers,
    // Kullanıcı isteği (2026-10-05, devam): "cinsiyetine yaş aralıklarına mahallelerden gelen
    // kullanıcılara kadar tümünü içeride analizlerini yapacak raporlama olsun" — eski sistemi
    // KULLANMIŞ 17.572 kişinin (yalnız top-10 değil, TÜMÜ) güncel Participants kaydıyla
    // eşleştirilip cinsiyet/yaş/mahalle kırılımı. Katılımcılar modülündeki demografi raporuyla
    // AYNI DTO şekli (Nexora.Application.Features.Participants.Dtos) kasıtlı olarak paylaşılır
    // — frontend aynı render bileşenini reuse edebilsin diye.
    Nexora.Application.Features.Participants.Dtos.ParticipantDemographicsOverviewDto? LegacyUserDemographics
);

public record TopLibraryDto(Guid LibraryId, string LibraryName, int VisitCount, double AvgOccupancyPct);
public record TopUserDto(string MemberName, string MaskedTckn, int VisitCount, double AvgSessionMinutes);
public record TopUserByHoursDto(string MemberName, string MaskedTckn, double TotalHours, int VisitCount);
public record HourlyLoadDto(int Hour, int VisitCount);
public record LegacyTopUserDto(string MemberName, string MaskedTckn, int TotalVisits, double TotalHours, DateTime FirstVisitAt, DateTime LastVisitAt, string? PrimaryLocationName, bool MatchedToParticipant);
