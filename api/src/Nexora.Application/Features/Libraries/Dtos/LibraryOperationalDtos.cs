using System.Text.Json.Serialization;

namespace Nexora.Application.Features.Libraries.Dtos;

public record OccupantDto(
    string Id,
    string MemberId,
    string MemberName,
    string? Seat,
    DateTime EntryTime,
    int DurationMinutes,
    int ShortBreaksRemaining,
    int LongBreaksRemaining,
    string Status,
    string? BreakType,
    string? FloorId = null);

public record QueueEntryDto(
    string Id,
    string QueueNumber,
    string MemberName,
    string Tckn,
    string Phone,
    string Method,
    string Status,
    DateTime JoinedAt,
    DateTime? CalledAt,
    DateTime? CountdownExpiresAt);

public record LibraryBreakDto(
    string Id,
    string MemberId,
    string MemberName,
    string SessionId,
    string Type,
    DateTime StartTime,
    int RemainingMinutes,
    bool SeatHeld,
    string? Seat,
    string? FloorId = null);

public record AllLibrariesPersonDto(
    string Id,
    string LibraryId,
    string LibraryName,
    string MemberId,
    string MemberName,
    string? Seat,
    DateTime SinceTime,
    int DurationMinutes,
    string Status);

public record AllLibrariesPersonListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Status { get; init; }
    public string? Search { get; init; }
}

public record ExitedSessionDto(
    string Id,
    string MemberId,
    string MemberName,
    DateTime EntryTime,
    DateTime ExitTime,
    int DurationMinutes,
    int ShortBreaksUsed,
    int LongBreaksUsed,
    string ExitType,
    string? Seat = null,
    string? FloorId = null);

public record StartBreakRequest(string Type);
public record ChangeSeatRequest(string Seat);
public record WarnRequest(string Message);

public record LibraryCheckInRequest(
    string? Tckn,
    string? ParticipantId,
    string? MemberName,
    string? Phone,
    string? BirthDate,
    string? GuardianPhone,
    string? Method,
    string? Seat);

public record LibraryCheckInResultDto(
    bool Entered,
    bool Queued,
    string? Seat,
    string? QueueNumber,
    string Message,
    int OverdueCount = 0,
    IReadOnlyList<EmanetOverdueBook>? OverdueBooks = null);

public record LibraryScanRequest(string Token, string Action = "entry");

public record PendingExitResultDto(DateTime PendingExitAt, int ExpiresInSeconds, string Message);

public record LibraryScanResultDto(string Action, string Message, string? Seat, string? ParticipantName = null);

public record LibraryStaticQrDto(bool Enabled, string Mode, string? Code, string? EntryCode = null, string? ExitCode = null,
    int MinExitSeconds = 3, int ReentryCooldownSeconds = 0);

public record ToggleLibraryStaticQrRequest(bool Enabled);

public record SetLibraryStaticQrModeRequest(string Mode);

// Kullanıcı isteği (2026-09-29, revize akşam: saniye cinsinden, dakika bekleme kaldırıldı):
// Facility'deki SetFacilityStaticQrTimingRequest ile eşdeğer — "attendance"/"entry_exit"/"split"
// modlarında giriş/çıkış zamana dayalı ayarlanabilir (saniye).
public record SetLibraryStaticQrTimingRequest(int MinExitSeconds, int ReentryCooldownSeconds);


public record LibraryReservationRequest(
    string? Tckn,
    string? ParticipantId,
    string? MemberName,
    string? Phone,
    string? BirthDate,
    string? GuardianPhone,
    string? Seat,
    DateTime? SlotStart,
    DateTime? SlotEnd);

public record LibraryReservationResultDto(string Id, string? Seat, DateTime HoldUntil, string Message);

public record EmanetOverdueBook(string Title, string? Author, DateTime DueDate, int DaysOverdue);

public record EmanetOverdueResult(bool HasOverdue, int Count, IReadOnlyList<EmanetOverdueBook> Books)
{
    public static readonly EmanetOverdueResult Empty = new(false, 0, []);
}

/// <summary>Flexcity (KTS emanet) entegrasyonunun durumu — sessizce çalışmadığı fark edilsin diye.</summary>
public record EmanetStatusDto(bool Enabled, bool Configured, DateTime? LastSuccessAt, DateTime? LastErrorAt, string? LastError);

public record OccupantListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record QueueListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 100;
}

public record BreakListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
}

public record ExitedListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Date { get; init; }
}

public class KtsEnvanterHareketDto
{
    public long Id { get; set; }
    public KtsEnvanterDto? KtsEnvanterDto { get; set; }
    public KtsUyeDto? KtsUyeDto { get; set; }
    [JsonPropertyName("teslimEdilmeTarihi")]
    public DateTime? TeslimEdilmeTarihi { get; set; }
    [JsonPropertyName("teslimAlmaTarihi")]
    public DateTime? TeslimAlmaTarihi { get; set; }
    [JsonPropertyName("yasalGetirmeTarihi")]
    public DateTime? YasalGetirmeTarihi { get; set; }
    [JsonPropertyName("rezervasyonTarihi")]
    public DateTime? ReservasyonTarihi { get; set; }
    [JsonPropertyName("turuAsStr")]
    public string? TuruAsStr { get; set; }
}

public class KtsEnvanterDto
{
    public long Id { get; set; }
    public string? Name { get; set; }
    public string? Title { get; set; }
    public string? Author { get; set; }
}

public class KtsUyeDto
{
    public long Id { get; set; }
    public string? AdSoyad { get; set; }
}

public record LibraryOverdueEntryDto(
    string MemberName,
    string Tckn,
    string LibraryId,
    string LibraryName,
    string BookTitle,
    string? BookAuthor,
    DateTime DueDate,
    int DaysOverdue
);

public record LibraryOverdueListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 20;
    public string? LibraryId { get; init; }
    public string? Search { get; init; }
}
