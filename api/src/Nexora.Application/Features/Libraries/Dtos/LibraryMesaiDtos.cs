namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryStaffDto(
    string Id,
    string? AdminUserId,
    string FullName,
    string? Email,
    string? Phone,
    string? RoleName,
    List<string> WorkingLibraryIds,
    bool IsActive,
    string? ActiveShiftId,
    string? ActiveLibraryId = null,
    string? ActiveLibraryName = null,
    DateTime? ActiveShiftStartTime = null,
    string LocationConsentStatus = "unknown",
    DateTime? LocationConsentUpdatedAt = null,
    bool CanEditOwnShifts = false,
    string? ParticipantId = null,
    bool HasDoorAccess = false,
    string SourceType = "admin");

// Kullanıcı talimatı (2026-08-04, revizyon): personel artık ya bir AdminUser'dan (klasik)
// ya da mevcut bir Participant/vatandaş kaydından (ID ile) atanabilir — "kişi hem
// katılımcı hem de görevli olabilir". Tam olarak biri (AdminUserId veya ParticipantId)
// dolu olmalı, ikisi birden değil. TCKN METNİ DEĞİL, doğrudan ParticipantId kullanılıyor —
// /participants listeleme ucu KVKK maskeleme ayarı (ParticipantSettings:MaskIdentity)
// açıkken TCKN'yi maskeli döndürür (ör. "610********"), bu yüzden frontend'in arama
// sonucundan aldığı TCKN metnine güvenilemez; ID her zaman maskesiz ve tekildir.
// HasDoorAccess=true ise personel kendi normal QR'ıyla (AdminUser ise nxr-staff_,
// Participant ise nxr-cid_) hangi kütüphanenin kapı cihazında olursa olsun giriş/çıkış
// yapabilir — WorkingLibraryIds'ten bağımsız.
public record LibraryStaffRequest(
    Guid? AdminUserId,
    Guid? ParticipantId,
    List<Guid> WorkingLibraryIds,
    bool CanEditOwnShifts = false,
    bool HasDoorAccess = false);

public record LocationConsentRequest(string Status);

public record MyMesaiDto(LibraryStaffDto? Staff, LibraryShiftDto? ActiveShift);

public record LibraryStaffListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? LibraryId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record LibraryShiftDto(
    string Id,
    string StaffId,
    string StaffName,
    string LibraryId,
    string LibraryName,
    DateTime StartTime,
    DateTime? EndTime,
    int? WorkedMinutes,
    string Status,
    string InitiationType,
    string? InitiatedByName,
    string? Location,
    string? Notes,
    bool EndedByIpTakeover,
    bool AutoClosedAtCutoff = false,
    bool WasEdited = false,
    DateTime? OriginalStartTime = null,
    DateTime? OriginalEndTime = null,
    string? LastEditedByName = null,
    DateTime? LastEditedAt = null,
    string? EditReason = null,
    // Kullanıcı isteği (2026-08-08): "belirli sürenin üstü mesai için otomatik uyarı" —
    // WorkedMinutes (aktif mesaide şu ana kadarki süre) config'teki LibraryMesai:
    // AnomalousShiftHours (varsayılan 14 saat) sınırını aşıyorsa true. Sert bir engelleme
    // DEĞİLDİR, sadece raporlarda/listelerde görsel bir uyarı işaretidir.
    bool IsAnomalousDuration = false);

public record StartShiftRequest(Guid StaffId, string? Location, string? Notes, double? Latitude = null, double? Longitude = null);

public record SelfShiftRequest(string? Location, string? Notes, double? Latitude = null, double? Longitude = null);

public record LibraryShiftListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Sort { get; init; }
    public string? Order { get; init; }
    public string? StaffId { get; init; }
    public string? LibraryId { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Status { get; init; }
}

public record MesaiSummaryDto(int ActiveShifts, int TodayShifts, int EligibleStaff);

public record MesaiOverviewSummaryDto(int ActiveShifts, int TodayShifts, int EligibleStaff, int LibrariesWithActiveShift);

public record EditShiftRequest(DateTime StartTime, DateTime EndTime, string? Reason);

public record StaffMesaiPeriodTotalsDto(
    string StaffId,
    string StaffName,
    int TotalMinutes,
    int ShiftCount,
    DateTime? FirstShiftStart,
    DateTime? LastShiftEnd,
    List<DailyMesaiTotalDto> DailyBreakdown,
    // Kullanıcı isteği (2026-08-08): "haftalık/aylık toplam çalışma saati bir üst sınırı
    // aşarsa bir uyarı/işaretleme sistemi eklenebilir mi" — istenen tarih aralığındaki
    // haftalardan en az biri LibraryMesai:MaxWeeklyHours'ı (varsayılan 60) aşmışsa true.
    // Sert bir engelleme DEĞİLDİR, yalnızca bilgilendirme amaçlıdır.
    bool HasWeekOverLimit = false,
    int MaxWeeklyHours = 60);

public record DailyMesaiTotalDto(DateOnly Date, int TotalMinutes, int ShiftCount);

/// <summary>Personelin kendi aylık mesai özeti (yalnız kendisi görür).</summary>
public record MyMesaiMonthSummaryDto(
    int Year,
    int Month,
    int TotalMinutes,
    int ShiftCount,
    int WorkedDays,
    int AutoClosedCount,
    List<MyMesaiLibraryTotalDto> ByLibrary,
    List<DailyMesaiTotalDto> Daily,
    List<LibraryShiftDto> Shifts);

public record MyMesaiLibraryTotalDto(string LibraryId, string LibraryName, int TotalMinutes, int ShiftCount);

/// <summary>Yönetici aylık detaylı mesai raporu (kişi × gün matrisi + tüm kırılımlar).</summary>
public record MesaiMonthlyReportDto(
    int Year,
    int Month,
    int DaysInMonth,
    int TotalMinutes,
    int ShiftCount,
    int StaffCount,
    int LibraryCount,
    int AutoClosedCount,
    int EditedCount,
    List<MesaiMonthlyStaffRowDto> Staff,
    List<MesaiMonthlyLibraryRowDto> Libraries,
    List<DailyMesaiTotalDto> Daily);

public record MesaiMonthlyStaffRowDto(
    string StaffId,
    string StaffName,
    string? RoleName,
    int TotalMinutes,
    int ShiftCount,
    int WorkedDays,
    int AvgDailyMinutes,
    int LongestDayMinutes,
    int AutoClosedCount,
    int EditedCount,
    string? FirstEntry,
    string? LastExit,
    /// <summary>Ayın her günü için dakika (index 0 = 1. gün).</summary>
    List<int> DayMinutes,
    List<MyMesaiLibraryTotalDto> ByLibrary);

public record MesaiMonthlyLibraryRowDto(string LibraryId, string LibraryName, int TotalMinutes, int ShiftCount, int StaffCount, int WorkedDays);

public record MesaiMonthlyReportParams
{
    public int? Year { get; init; }
    public int? Month { get; init; }
    public string? LibraryId { get; init; }
    public string? StaffId { get; init; }
}

public record TopMesaiStaffDto(string StaffId, string StaffName, string? RoleName, int TotalMinutes, int ShiftCount, int DistinctLibraryCount);

public record MesaiLeaderboardParams
{
    public int? Year { get; init; }
    public int? Month { get; init; }
    public string? LibraryId { get; init; }
    // Kod denetimi 2026-08-08 (kullanıcı isteği: mesai sistemi derin denetim, canlı testte
    // bulundu) — non-nullable "int Limit = 20" [AsParameters] minimal API model binding'inde
    // varsayılan değeri yok sayıyor ve query string'de "limit" olmadığında
    // BadHttpRequestException ("Required parameter... was not provided") fırlatıyordu; GET
    // /api/v1/mesai/leaderboard limit parametresi olmadan çağrıldığında HER ZAMAN 500 dönüyordu.
    // Nullable yapılıp servis katmanında (LibraryShiftService.GetLeaderboardAsync zaten
    // `p.Limit <= 0 ? 20 : p.Limit` fallback'i içeriyordu) çözülmesi sağlandı.
    public int? Limit { get; init; } = 20;
}

public record MesaiReportSummaryDto(
    int TotalShifts,
    int TotalMinutes,
    int AutoClosedCount,
    int EditedCount,
    int DistinctStaffCount,
    // Kullanıcı isteği (2026-08-08): "mesai sistemi derin denetim" — çok kısa süreli
    // (<5 dakika) bitmiş mesai kayıtları genelde terminal devralma flapping'i (IP takeover)
    // ya da yanlışlıkla giriş/çıkış gibi hatalı kayıtları işaret eder. Raporlarda öne çıkarılır.
    int ShortLivedCount,
    int IpTakeoverCount);

public record DoorQrToggleResultDto(bool Entered, string StaffName, string Message, string? LibraryName = null);
