namespace Nexora.Application.Features.ParticipantLibraries.Dtos;

public record CitizenLibraryDto(
    Guid Id,
    string Name,
    string? ImageUrl,
    string? District,
    string? City,
    string? Address,
    int Capacity,
    int FloorCount,
    List<string> Amenities,
    string? ManagerPhone,
    string SeatingMode,
    string AccessType,
    string? DeviceKind,
    bool ReservationEnabled,
    bool QueueEnabled,
    int Inside,
    int OnBreak,
    int Free,
    int Waiting,
    double? Latitude,
    double? Longitude,
    string AreaType = "mixed",
    double OccupancyRate = 0,
    // Denetim bulgusu (2026-09-06): bkz. CitizenLibraryDetailDto.EntryControlMode — aynı
    // gerekçeyle liste/keşfet ekranındaki "QR Girişli" rozeti de artık gerçek giriş
    // yöntemini yansıtabilsin diye eklendi.
    string EntryControlMode = "qr"
);

public record CitizenLibraryAreaOptionDto(string Value, string Label, int Count);

public record CitizenLibraryFiltersDto(
    List<CitizenLibraryAreaOptionDto> AreaTypes,
    int TotalCount,
    int AvailableCount,
    /// <summary>İlçe seçenekleri (ad + kayıt sayısı).</summary>
    List<CitizenLibraryAreaOptionDto>? Districts = null,
    /// <summary>Erişim tipi seçenekleri (open/qr/device).</summary>
    List<CitizenLibraryAreaOptionDto>? AccessTypes = null,
    /// <summary>Yer ayırtılabilen kıraathane sayısı.</summary>
    int ReservableCount = 0,
    /// <summary>Oturma düzeni seçenekleri (masalı/sıralı).</summary>
    List<CitizenLibraryAreaOptionDto>? SeatingModes = null,
    /// <summary>Olanak seçenekleri (wifi, kafeterya vb.).</summary>
    List<CitizenLibraryAreaOptionDto>? Amenities = null,
    /// <summary>Sıra sistemi açık olan kıraathane sayısı.</summary>
    int QueueEnabledCount = 0);

public record CitizenLibraryRuleDto(
    Guid Id,
    string Category,
    string Title,
    string Description,
    string Icon,
    string Severity
);

public record CitizenLibraryDetailDto(
    Guid Id,
    string Name,
    string? ImageUrl,
    string? Description,
    string? District,
    string? City,
    string? Address,
    int Capacity,
    int FloorCount,
    bool IsMultiFloor,
    List<string> Amenities,
    string? ManagerPhone,
    string? EmergencyPhone,
    string SeatingMode,
    string AccessType,
    string? DeviceKind,
    bool ReservationEnabled,
    bool QueueEnabled,
    int ReservationHoldWindowMinutes,
    int MaxReservationMinutes,
    int BreakDurationMinutes,
    int LongBreakDurationMinutes,
    int MaxDailyBreaks,
    int MaxDailyLongBreaks,
    int ShortBreakCooldownMinutes,
    int BreakReturnGraceMinutes,
    List<CitizenLibraryRuleDto> Rules,
    bool StaticQrEnabled = false,
    // Kullanıcı isteği: kütüphaneler de hizmet tesisleri gibi otopark ve en yakın acil
    // toplanma alanı bilgisi verebilsin (bağlı ServiceFacility'den ve EmergencyAreas'tan).
    int? ParkingCapacity = null,
    string? ParkingType = null,
    string? NearestEmergencyAreaName = null,
    double? NearestEmergencyAreaDistanceKm = null,
    // Denetim bulgusu (2026-10-02): liste ekranı (CitizenLibraryDto) mesafe/harita
    // gösterebilmek için Latitude/Longitude taşıyordu ama detay DTO'su taşımıyordu —
    // detay yüklendiğinde route'tan gelen liste nesnesinin yerini aldığı için (bkz.
    // mobil LibraryDetailScreen "detail ?? routeLibrary") koordinatlar kaybolup
    // "Haritada Göster"/uzaklık özelliği detay ekranında sessizce çalışmaz oluyordu.
    double? Latitude = null,
    double? Longitude = null,
    // Denetim bulgusu (2026-09-06, kullanıcı isteği: Gezi/Kütüphane check-in denetimi):
    // Vatandaş portalı önceden yalnızca AccessType'a (open/qr/device) bakarak "QR ile Giriş
    // Yap" akışını gösteriyordu; EntryControlMode="manual" (görevli elle kayıt) olan
    // kütüphanelerde de aynı QR-üret-okut ekranı çıkıyordu — ama o kütüphanede okutacak
    // hiçbir cihaz/okuyucu yok, vatandaş oluşan QR'ı hiçbir yere gösteremiyordu. Bu alan
    // eklenerek UI artık gerçek giriş yöntemine göre doğru mesaj/akış gösterebilir.
    string EntryControlMode = "qr",
    string StaticQrMode = "attendance"
);

public record CitizenSessionDto(
    Guid Id,
    Guid LibraryId,
    string LibraryName,
    string? District,
    string? FloorName,
    string? SectionName,
    string? SeatLabel,
    string Status,
    DateTime EntryTime,
    int DurationMinutes,
    DateTime? EstimatedExitAt,
    int? RemainingMinutes,
    int? MaxStudyMinutes,
    DateTime? BreakEndsAt,
    int? BreakRemainingMinutes,
    string? BreakType,
    int ShortBreaksUsed,
    int LongBreaksUsed,
    int? RemainingShortBreaks,
    int? RemainingLongBreaks,
    int BreakDurationMinutes,
    int LongBreakDurationMinutes,
    bool BreakSystemEnabled
);

public record CitizenBreakRequest(string? Type);

public record CitizenLibraryMovementDto(
    Guid Id,
    string Kind,
    string LibraryName,
    string? FloorName,
    string? SeatLabel,
    DateTime At,
    string? BreakType);

public record CitizenAccessQrDto(string Token, int RotationSeconds, DateTime ExpiresAt);

public record CitizenWalkInRequest(string? Seat);

public record CitizenLibraryHourlyLoadDto(int Hour, int Count);

public record CitizenLibraryStatsDto(
    int Capacity,
    int ActiveNow,
    double OccupancyRate,
    int? PeakHour,
    int TodayEntries,
    int TodayExits,
    double AvgStayMinutes,
    List<CitizenLibraryHourlyLoadDto> HourlyLoad);

public record CitizenLibraryMyStatsDto(
    int TotalVisits,
    int TotalExits,
    int TotalMinutes,
    int MonthMinutes,
    int WeekMinutes,
    int TodayMinutes,
    int ShortBreaks,
    int LongBreaks,
    int NoShowExits,
    double AvgSessionMinutes);

public record CitizenFloorCountDto(string Id, string Name, int Capacity, int Inside);

public record CitizenStatusPersonDto(string Name, bool IsMe, string? Seat, int? BreakRemainingMinutes);

public record CitizenStatusQueueDto(string Name, bool IsMe, int Position, string Status, int? CallRemainingMinutes);

public record CitizenMyLibraryStateDto(
    string State,
    int? QueuePosition,
    string? QueueStatus,
    int? CallRemainingMinutes,
    string? Seat,
    int? HoldRemainingMinutes);

public record CitizenLibraryStatusDto(
    Guid LibraryId,
    string Name,
    string SeatingMode,
    bool ReservationEnabled,
    bool ReservationAllowed,
    bool QueueEnabled,
    int Capacity,
    int Inside,
    int OnBreak,
    int Free,
    int Waiting,
    List<CitizenFloorCountDto> Floors,
    List<CitizenStatusPersonDto> InsideList,
    List<CitizenStatusPersonDto> OnBreakList,
    List<CitizenStatusQueueDto> QueueList,
    CitizenMyLibraryStateDto My,
    bool BreakSystemEnabled);

public record CitizenQueueJoinResultDto(string Id, int Position, string QueueNumber);

public record CitizenMyQueueDto(
    string Id,
    string LibraryId,
    string LibraryName,
    int Position,
    string Status,
    int? CallRemainingMinutes,
    string QueueNumber);

public record CitizenLibrarySeatDto(string Key, int Number, string Label, string Status);

public record CitizenLibrarySeatTableDto(string Id, string Name, int SeatCount, List<CitizenLibrarySeatDto> Seats);

public record CitizenLibrarySeatSectionDto(string Id, string Name, string Type, string Color, int Capacity, List<CitizenLibrarySeatTableDto> Tables);

public record CitizenLibraryFloorDto(string Id, string Name, int Capacity, string? KrokiUrl, List<CitizenLibrarySeatDto> Seats, List<CitizenLibrarySeatSectionDto>? Sections);

public record CitizenLibrarySeatPlanDto(string SeatingMode, List<CitizenLibraryFloorDto> Floors);

public record CitizenLibraryReservationDto(
    Guid Id,
    Guid LibraryId,
    string LibraryName,
    string? District,
    string? Seat,
    string? FloorName,
    string? SectionName,
    string? SeatLabel,
    string Status,
    DateTime ReservedAt,
    DateTime? SlotStart,
    DateTime? SlotEnd,
    DateTime HoldUntil
);
