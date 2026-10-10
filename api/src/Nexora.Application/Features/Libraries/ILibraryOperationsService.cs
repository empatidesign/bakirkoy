using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries;

public interface ILibraryOperationsService
{
    Task<PagedResult<OccupantDto>> GetOccupantsAsync(Guid libraryId, OccupantListParams p, CancellationToken ct);
    Task<PagedResult<AllLibrariesPersonDto>> GetAllLibrariesPersonsAsync(AllLibrariesPersonListParams p, CancellationToken ct);
    Task<PagedResult<QueueEntryDto>> GetQueueAsync(Guid libraryId, QueueListParams p, CancellationToken ct);
    Task<PagedResult<LibraryBreakDto>> GetBreaksAsync(Guid libraryId, BreakListParams p, CancellationToken ct);
    Task<PagedResult<ExitedSessionDto>> GetExitedAsync(Guid libraryId, ExitedListParams p, CancellationToken ct);

    Task<LibraryCheckInResultDto> CheckInAsync(Guid libraryId, LibraryCheckInRequest req, CancellationToken ct);
    Task<LibraryCheckInResultDto> CheckInAsync(Guid libraryId, LibraryCheckInRequest req, bool triggerDoor, CancellationToken ct);
    Task<LibraryScanResultDto> ScanAccessAsync(Guid libraryId, string token, string action, CancellationToken ct);
    Task<LibraryScanResultDto> ScanAccessAsync(Guid libraryId, string token, string action, int? toggleCooldownMinutes, CancellationToken ct);
    Task<LibraryScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, double? latitude, double? longitude, CancellationToken ct);
    Task StartBreakAsync(Guid sessionId, StartBreakRequest req, CancellationToken ct);
    Task EndBreakAsync(Guid breakId, CancellationToken ct);
    Task ExitAsync(Guid sessionId, CancellationToken ct);
    Task ExitAsync(Guid sessionId, bool byStaff, CancellationToken ct);
    Task ExitAsync(Guid sessionId, bool byStaff, bool triggerDoor, CancellationToken ct);
    Task ChangeSeatAsync(Guid sessionId, ChangeSeatRequest req, CancellationToken ct);

    Task CallNextAsync(Guid libraryId, CancellationToken ct);
    Task TryPromoteQueueAsync(Guid libraryId, CancellationToken ct);
    Task MarkEnteredAsync(Guid queueId, CancellationToken ct);
    Task ExpireQueueAsync(Guid queueId, CancellationToken ct);

    Task WarnAsync(Guid memberId, WarnRequest req, CancellationToken ct);
    Task<LibraryReservationResultDto> CreateReservationAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct);
    Task<LibraryReservationResultDto> WalkInAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct);
    Task CancelReservationAsync(Guid reservationId, CancellationToken ct);
    Task<int> JoinQueueAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct);
    Task LeaveQueueAsync(Guid libraryId, Guid participantId, CancellationToken ct);

    Task<LibrarySeatPlanDto> GetSeatPlanAsync(Guid libraryId, CancellationToken ct);
    Task SaveSeatMaintenanceAsync(Guid libraryId, SeatMaintenanceRequest req, CancellationToken ct);
    Task<LibrarySeatPlanDto> SaveSeatStructureAsync(Guid libraryId, SeatStructureRequest req, CancellationToken ct);

    Task<PagedResult<LibraryOverdueEntryDto>> GetOverdueBooksAsync(LibraryOverdueListParams p, CancellationToken ct);

    Task<LibraryStaticQrDto> GetStaticQrAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryStaticQrDto> ToggleStaticQrAsync(Guid libraryId, bool enabled, CancellationToken ct);
    Task<LibraryStaticQrDto> SetStaticQrModeAsync(Guid libraryId, string mode, CancellationToken ct);
    Task<LibraryStaticQrDto> SetStaticQrTimingAsync(Guid libraryId, int minExitMinutes, int reentryCooldownMinutes, CancellationToken ct);
    Task<LibraryStaticQrDto> RotateStaticQrAsync(Guid libraryId, CancellationToken ct);
}

public interface ILibraryNotificationService
{
    // Denetim bulgusu 2026-08-08 (badger ajanı, docs/sablon-sistemi-baglanti-denetimi-2026-08-08.md):
    // LibrarySettingsDto.NotificationTemplates alanı ve LibraryMessageRenderer önceki bir oturumda
    // scaffold edilmişti ama bu servis hiçbir zaman bunları kullanmıyordu (ölü kod) - tüm mesajlar
    // sabit C# string interpolasyonuydu. libraryId parametresi eklendi ki her metod ilgili
    // kütüphanenin (veya genel) şablonunu çekip kullanabilsin; şablon boşsa/devre dışıysa aynı
    // hardcoded metne düşülüyor (geriye dönük uyumlu, davranış değişikliği yok).
    Task NotifyGuardianOnExitAsync(Guid libraryId, string libraryName, string memberName, DateTime? birthDate, string? guardianPhone, CancellationToken ct);
    Task NotifyStaffOverdueAsync(Guid libraryId, string memberName, int overdueCount, CancellationToken ct);
    Task NotifyMemberWarnAsync(Guid libraryId, string libraryName, string eventKey, Guid? participantId, string? phone, string memberName, string message, CancellationToken ct);
    Task NotifyReservationCancelledAsync(Guid libraryId, Guid? participantId, string? phone, string memberName, string libraryName, bool byStaff, CancellationToken ct);
    Task NotifyReservationExpiredAsync(Guid libraryId, Guid? participantId, string? phone, string memberName, string libraryName, CancellationToken ct);
    Task<LibraryManualMessageResultDto> SendManualMessageAsync(Guid libraryId, List<Guid>? sessionIds, string templateEvent, string? customText, bool sms, bool notify, string? smsOtp, CancellationToken ct);
}

public interface IEmanetService
{
    Task<EmanetStatusDto> GetStatusAsync(CancellationToken ct);
    Task<Dtos.EmanetOverdueResult> GetOverdueAsync(string tckn, CancellationToken ct);
    Task<List<Dtos.LibraryOverdueEntryDto>> GetAllOverdueForLibraryAsync(string libraryId, string libraryName, IEnumerable<(string tckn, string memberName)> members, CancellationToken ct);
}
