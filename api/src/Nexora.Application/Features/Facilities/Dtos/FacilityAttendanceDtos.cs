namespace Nexora.Application.Features.Facilities.Dtos;

public record AttendanceRosterItemDto(
    Guid RegistrationId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Kind,
    int AbsenceUsed,
    int ConsecutiveAbsenceUsed,
    string Status,
    bool CheckedInViaQr = false,
    int AbsenceLimit = 0,
    int ConsecutiveAbsenceLimit = 0
);

public record AttendanceMark(Guid RegistrationId, string Status);

public record SaveAttendanceRequest(Guid SessionId, List<AttendanceMark> Marks, bool Confirm = false);

public record SaveAttendanceResult(int Marked, int Removed);

public record CheckInRequest(Guid SessionId, string Tckn);

public record ManualCheckInRequest(Guid FacilityId, string Tckn);

public record QrCheckInRequest(Guid FacilityId, string Code);

public record AttendanceCheckInResultDto(
    bool Found,
    string FullName,
    string GroupName,
    string Status,
    DateTime? SessionDate,
    string Message
);

public record DeviceCheckInRequest(string DeviceCode, string Code);

public record DeviceCheckInResultDto(
    bool Allowed,
    string Message,
    string? ParticipantName,
    string? GroupName,
    string? SessionTime
);

public record AttendanceHistoryItemDto(
    Guid AttendanceId,
    Guid SessionId,
    DateTime SessionDate,
    string StartTime,
    string EndTime,
    string Status,
    string Method,
    bool CheckedInViaQr,
    DateTime MarkedAt,
    string? MarkedBy
);

public record ReviseAttendanceRequest(Guid SessionId, string Status, bool Confirm = false);

public record FacilityStaticQrDto(bool Enabled, string Mode, string? Code, string? EntryCode = null, string? ExitCode = null,
    int MinExitSeconds = 3, int ReentryCooldownSeconds = 0);

public record ToggleFacilityStaticQrRequest(bool Enabled);

public record SetFacilityStaticQrModeRequest(string Mode);

// Kullanıcı isteği (2026-09-29, revize akşam: saniye cinsinden, dakika bekleme kaldırıldı):
// "attendance"/"entry_exit"/"split" modlarında giriş/çıkış zamana dayalı ayarlanabilir (saniye).
public record SetFacilityStaticQrTimingRequest(int MinExitSeconds, int ReentryCooldownSeconds);

public record StaticQrScanResultDto(bool Allowed, string Message, string? ParticipantName, string? GroupName, string? Action, string? ErrorCode = null);

