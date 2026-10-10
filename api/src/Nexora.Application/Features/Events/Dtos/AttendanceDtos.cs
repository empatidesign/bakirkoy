namespace Nexora.Application.Features.Events.Dtos;

public record ActivityDto(
    Guid Id,
    string Kind,
    DateTime At,
    Guid EventId,
    string EventName,
    string? SessionLabel,
    string ParticipantName,
    string Tckn,
    string Method,
    string Status,
    bool WalkIn
);

public record ActivitySummaryDto(int CheckIn, int CheckOut, int Kiosk, int WalkIn);

public record QrCodeDto(
    Guid Id,
    string Code,
    string ParticipantName,
    string Tckn,
    string EventName,
    DateTime Date,
    string? Time,
    string? SeatNumber,
    string Status,
    int ScannedCount,
    int MaxUsage,
    DateTime? ValidUntil
);

public record QrSummaryDto(int Total, int Active, int Used, int Inactive);

// Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
// cihazsız çalışsın, aynı mantık her yerde geçerli olsun" — Facility'deki FacilityStaticQrDto/
// StaticQrScanResultDto ile BİREBİR aynı şekil, sadece Event'e uyarlandı.
public record EventStaticQrDto(bool Enabled, string Mode, string? Code, string? EntryCode = null, string? ExitCode = null,
    int MinExitSeconds = 3, int ReentryCooldownSeconds = 0);

public record ToggleEventStaticQrRequest(bool Enabled);

public record SetEventStaticQrModeRequest(string Mode);

public record SetEventStaticQrTimingRequest(int MinExitSeconds, int ReentryCooldownSeconds);

public record EventStaticQrScanResultDto(bool Allowed, string Message, string? ParticipantName, string? EventName, string? Action, string? ErrorCode = null);
