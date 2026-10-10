using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibraryOperationsService(
    IUnitOfWork uow,
    ILibrarySettingsService settings,
    ILibraryNotificationService notify,
    IEmanetService emanet,
    ICurrentUser current,
    IAuditService audit,
    ICitizenIdentityQrService cidQr,
    ILibraryLockController locks,
    ILibrarySessionRealtimeNotifier realtime,
    ITemplateRuleEngine templateEngine,
    IUserScopeService userScope,
    Microsoft.Extensions.Configuration.IConfiguration config) : ILibraryOperationsService
{
    private async Task EnsureInScopeAsync(Guid libraryId, CancellationToken ct)
    {
        if (current.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(libraryId))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    private bool DisableBreakTimingRules => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:DisableBreakTimingRules", false);

    private int QueueCallWindowMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:QueueCallWindowMinutes", 5);
    private int BreakIntervalMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:BreakIntervalMinutes", 60);

    private async Task BroadcastOccupancyAsync(Guid libraryId, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        if (library is null) return;
        var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
        var onBreak = await uow.LibrarySessions.CountOnBreakAsync(libraryId, ct);
        var waiting = await uow.LibraryQueue.CountWaitingAsync(libraryId, ct);
        var free = Math.Max(0, library.Capacity - inside);
        _ = realtime.NotifyOccupancyChangedAsync(
            new LibraryOccupancyEvent(libraryId, Math.Max(0, inside - onBreak), onBreak, free, waiting, DateTime.UtcNow),
            CancellationToken.None);
    }

    public async Task TryPromoteQueueAsync(Guid libraryId, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        if (library is null || !library.IsActive || !library.QueueEnabled) return;
        var s = await settings.GetAsync(libraryId, ct);
        if (!s.AutoQueueCallEnabled) return;

        if (uow.HasActiveTransaction)
            await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);

        if (await uow.LibraryQueue.HasCalledAsync(libraryId, ct)) return;
        var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
        if (inside >= library.Capacity) return;
        var front = await uow.LibraryQueue.GetFrontWaitingAsync(libraryId, ct);
        if (front is null) return;

        front.Call(Math.Max(1, QueueCallWindowMinutes));
        uow.LibraryQueue.Update(front);
        await uow.SaveChangesAsync(ct);

        if (front.ParticipantId is Guid pid)
            _ = realtime.NotifyQueueCalledAsync(pid, new LibraryQueueCalledEvent(
                libraryId, library.Name, null, front.CountdownExpiresAt, DateTime.UtcNow), CancellationToken.None);

        try { await notify.NotifyMemberWarnAsync(libraryId, library.Name, "queue_called", front.ParticipantId, front.Phone, front.MemberName, "Sıranız geldi! Belirtilen süre içinde kıraathaneye giriş yapın.", ct); }
        catch { }
        await LogAsync(AuditAction.Update, "LibraryQueueEntry", front.Id, $"Sıra otomatik çağrıldı: {front.MemberName}", ct);
    }

    public async Task<LibraryScanResultDto> ScanAccessAsync(Guid libraryId, string token, string action, CancellationToken ct)
        => await ScanAccessAsync(libraryId, token, action, null, ct);

    public async Task<LibraryScanResultDto> ScanAccessAsync(Guid libraryId, string token, string action, int? toggleCooldownMinutes, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);

        var (verified, participantId) = await cidQr.TryVerifyAsync(token, ct);
        if (!verified)
            throw new ConflictException("QR kodu okunamadı veya süresi doldu. Uygulamadaki QR kodunuzu yenileyip tekrar okutun.", "INVALID_QR");

        var library = await GetLibraryAsync(libraryId, ct);
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        LibraryScanResultDto result;
        Domain.Entities.Libraries.LibrarySession? session;
        try
        {
            await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);
            session = await uow.LibrarySessions.GetActiveByParticipantAsync(participantId, ct);

            result = action == "toggle"
                ? await ExecuteToggleScanAsync(libraryId, library, session, participantId, toggleCooldownMinutes ?? 5, ct)
                : await ExecuteScanActionAsync(libraryId, action, library, session, participantId, ct);

            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        var status = StatusFromResult(result.Action);
        _ = realtime.NotifySessionChangedAsync(participantId, new LibrarySessionEvent(
            action, libraryId, library.Name, status, result.Seat ?? session?.Seat, DateTime.UtcNow), CancellationToken.None);

        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        return result with { ParticipantName = participant?.FullName ?? session?.MemberName };
    }

    private async Task<LibraryScanResultDto> ExecuteToggleScanAsync(
        Guid libraryId, Domain.Entities.Libraries.Library library,
        Domain.Entities.Libraries.LibrarySession? session, Guid participantId, int cooldownMinutes, CancellationToken ct)
    {
        if (session is not null && session.LibraryId != libraryId)
            throw await ActiveSessionConflictAsync(session, libraryId, ct);

        if (session is null)
        {
            var s = await settings.GetAsync(libraryId, ct);
            var m = await ResolveMemberAsync(participantId.ToString(), null, null, null, null, null, ct);

            await EnforceDailyVisitCapAsync(m.ParticipantId, m.Tckn, libraryId, s, ct);

            if (s.BlockEntryOnOverdue && !string.IsNullOrWhiteSpace(m.Tckn))
            {
                var scanOverdue = await emanet.GetOverdueAsync(m.Tckn, ct);
                if (scanOverdue.HasOverdue)
                {
                    await notify.NotifyStaffOverdueAsync(libraryId, m.Name, scanOverdue.Count, ct);
                    throw new ConflictException(
                        $"{m.Name} teslim tarihi geçmiş {scanOverdue.Count} emanet/kitabı olduğu için giriş yapamaz. Lütfen önce iade edin.",
                        "MEMBER_HAS_OVERDUE_ITEMS");
                }
            }

            var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
            if (inside >= library.Capacity)
                throw new ConflictException("Kıraathane dolu.", "LIBRARY_FULL");

            string? seat = null;
            LibraryReservation? reservation = null;
            if (library.SeatingMode == "masali")
            {
                reservation = await ResolveHeldReservationAsync(m.ParticipantId, m.Tckn, libraryId, ct);
                if (reservation is null)
                    throw new ConflictException("Önce mobil uygulamadan masa/koltuk seçmelisiniz.", "SEAT_REQUIRED");
                seat = reservation.Seat;
            }

            var newSession = LibrarySession.Create(libraryId, m.ParticipantId, m.Name, m.Tckn, m.Phone, m.BirthDate, m.GuardianPhone, seat, reservation?.Id, "qr");
            // Kod denetimi 2026-10-06 (kullanıcı isteği: "QR okutma her yerde aynı mantıkta çalışsın"
            // denetimi sırasında bulundu): kapı DB commit'ten SONRA tetikleniyordu — kapı/kilit
            // açılamazsa kullanıcıya hata dönüyordu ama oturum kaydı zaten yazılmıştı (Facility/
            // FacilityAttendanceService.cs'teki 2026-08-08 crab bulgusuyla aynı atomiklik sorunu,
            // Facility'de düzeltilmişti ama Kütüphane'ye hiç uygulanmamıştı). Kapı önce
            // tetikleniyor (Id zaten client-side üretilmiş GUID, SaveChangesAsync'e ihtiyaç yok);
            // açılamazsa hiçbir DB yazımı yapılmadan exception fırlatılır.
            await TriggerDoorAsync(library, newSession.Id, "entry", m.Name, ct);
            await uow.LibrarySessions.AddAsync(newSession, ct);
            if (reservation is not null) { reservation.Consume(); uow.LibraryReservations.Update(reservation); }
            await uow.SaveChangesAsync(ct);

            await LogAsync(AuditAction.CheckIn, "LibrarySession", newSession.Id, $"Kıraathane girişi (toggle cihaz): {m.Name}", ct);
            await BroadcastOccupancyAsync(libraryId, ct);
            return new LibraryScanResultDto("checkin", "Giriş yapıldı.", seat);
        }

        if (session.IsOnBreak)
        {
            var activeBreak = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
            if (activeBreak is not null)
                await EndBreakAsync(activeBreak.Id, ct);
            return new LibraryScanResultDto("end_break", "Moladan dönüldü.", session.Seat);
        }

        switch (session.PendingAction)
        {
            case "short_break":
            case "long_break":
            {
                var type = session.PendingAction == "long_break" ? "long" : "short";
                session.ClearPendingAction();
                uow.LibrarySessions.Update(session);
                await StartBreakAsync(session.Id, new StartBreakRequest(type), ct);
                return new LibraryScanResultDto(
                    type == "long" ? "long_break" : "short_break",
                    type == "long" ? "Uzun mola başladı." : "Kısa mola başladı.",
                    session.Seat);
            }
            case "exit":
            {
                session.ClearPendingAction();
                uow.LibrarySessions.Update(session);
                await ExitAsync(session.Id, false, ct);
                return new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
            }
        }

        var elapsedMinutes = (DateTime.UtcNow - session.EntryTime).TotalMinutes;
        if (elapsedMinutes < cooldownMinutes)
        {
            var remaining = (int)Math.Ceiling(cooldownMinutes - elapsedMinutes);
            throw new ConflictException(
                $"{remaining} dk sonra çıkış yapabilirsiniz.",
                "TOGGLE_COOLDOWN_ACTIVE");
        }

        await ExitAsync(session.Id, false, ct);
        return new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
    }

    private static string? StatusFromResult(string resultAction) => resultAction switch
    {
        "checkin" => "inside",
        "end_break" => "inside",
        "short_break" => "on_break_short",
        "long_break" => "on_break_long",
        "checkout" => null,
        "queued" => null,
        _ => null,
    };

    private async Task<LibraryScanResultDto> ExecuteScanActionAsync(
        Guid libraryId, string action, Domain.Entities.Libraries.Library library,
        Domain.Entities.Libraries.LibrarySession? session, Guid participantId, CancellationToken ct)
    {
        switch (action)
        {
            case "entry":
            {
                if (session is not null && session.IsOnBreak)
                {
                    var activeBreak = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
                    if (activeBreak is not null)
                        await EndBreakAsync(activeBreak.Id, ct);
                    return new LibraryScanResultDto("end_break", "Moladan dönüldü.", session.Seat);
                }

                if (session is not null && session.PendingAction == "exit")
                {
                    session.ClearPendingAction();
                    uow.LibrarySessions.Update(session);
                    await ExitAsync(session.Id, false, ct);
                    return new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
                }
                if (session is not null && session.LibraryId == libraryId && DateTime.UtcNow - session.EntryTime < TimeSpan.FromSeconds(15))
                    return new LibraryScanResultDto("checkin", "Giriş yapıldı.", session.Seat);
                if (session is not null)
                    throw await ActiveSessionConflictAsync(session, libraryId, ct);

                var reservation = await uow.LibraryReservations.GetActiveHoldByParticipantAsync(participantId, ct);
                var hasResHere = reservation is not null && reservation.LibraryId == libraryId && reservation.HoldUntil > DateTime.UtcNow;
                if (hasResHere)
                {
                    var req = new LibraryCheckInRequest(null, participantId.ToString(), null, null, null, null, "qr", null);
                    var result = await CheckInAsync(libraryId, req, ct);
                    return new LibraryScanResultDto(result.Entered ? "checkin" : "queued", result.Message, result.Seat);
                }

                var calledQueue = await uow.LibraryQueue.GetActiveByParticipantAsync(participantId, libraryId, ct);
                var calledOk = calledQueue is { Status: "called" } && (calledQueue.CountdownExpiresAt is null || calledQueue.CountdownExpiresAt > DateTime.UtcNow);
                if (calledOk)
                {
                    if (library.SeatingMode == "masali")
                        throw new ConflictException("Sıranız geldi. Önce boş bir koltuk seçin.", "SEAT_REQUIRED");
                    await MarkEnteredAsync(calledQueue!.Id, ct);
                    return new LibraryScanResultDto("checkin", "Giriş yapıldı.", null);
                }

                if (library.SeatingMode == "sirali")
                {
                    await EnsureReentryCooldownElapsedAsync(library, participantId, ct);
                    var walkIn = new LibraryCheckInRequest(null, participantId.ToString(), null, null, null, null, "qr", null);
                    var walkInResult = await CheckInAsync(libraryId, walkIn, ct);
                    return new LibraryScanResultDto(walkInResult.Entered ? "checkin" : "queued", walkInResult.Message, walkInResult.Seat);
                }

                throw new ConflictException("Geçerli bir giriş hakkınız yok. Rezervasyon yapın, boş yer seçin veya sıranızı bekleyin.", "NO_ENTRY_RIGHT");
            }
            case "exit":
            {
                if (session is null || session.LibraryId != libraryId)
                {
                    var now = DateTime.UtcNow;
                    var recent = await uow.LibrarySessions.GetByParticipantEntryRangeAsync(participantId, now.AddDays(-1), now, ct);
                    var justExited = recent.FirstOrDefault(s => s.LibraryId == libraryId && s.ExitTime is DateTime t && now - t < TimeSpan.FromSeconds(15));
                    if (justExited is not null)
                        return new LibraryScanResultDto("checkout", "Çıkış yapıldı.", justExited.Seat);
                    throw new ConflictException("Bu kıraathanede aktif oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
                }

                if (session.IsOnBreak)
                {
                    var activeBreak = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
                    if (activeBreak is not null)
                        await EndBreakAsync(activeBreak.Id, ct);
                    return new LibraryScanResultDto("end_break", "Moladan dönüldü.", session.Seat);
                }

                if (session.PendingAction is "short_break" or "long_break")
                {
                    var type = session.PendingAction == "long_break" ? "long" : "short";
                    session.ClearPendingAction();
                    uow.LibrarySessions.Update(session);
                    await StartBreakAsync(session.Id, new StartBreakRequest(type), ct);
                    return new LibraryScanResultDto(
                        type == "long" ? "long_break" : "short_break",
                        type == "long" ? "Uzun mola başladı." : "Kısa mola başladı.",
                        session.Seat);
                }

                await ExitAsync(session.Id, ct);
                return new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
            }
            case "short_break":
            {
                if (session is null || session.LibraryId != libraryId)
                    throw new ConflictException("Bu kıraathanede aktif oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
                await StartBreakAsync(session.Id, new StartBreakRequest("short"), ct);
                return new LibraryScanResultDto("short_break", "Kısa mola başladı.", session.Seat);
            }
            case "long_break":
            {
                if (session is null || session.LibraryId != libraryId)
                    throw new ConflictException("Bu kıraathanede aktif oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
                await StartBreakAsync(session.Id, new StartBreakRequest("long"), ct);
                return new LibraryScanResultDto("long_break", "Uzun mola başladı.", session.Seat);
            }
            case "end_break":
            {
                if (session is null || session.LibraryId != libraryId)
                    throw new ConflictException("Bu kıraathanede aktif oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
                var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct)
                    ?? throw new ConflictException("Aktif bir molanız bulunmuyor.", "NO_ACTIVE_BREAK");
                await EndBreakAsync(brk.Id, ct);
                return new LibraryScanResultDto("end_break", "Moladan dönüldü.", session.Seat);
            }
            default:
                throw new ConflictException("Geçersiz işlem türü.", "INVALID_ACTION");
        }
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private static int MinutesSince(DateTime from) => (int)Math.Max(0, (DateTime.UtcNow - from).TotalMinutes);
    private static int MinutesUntil(DateTime to) => (int)Math.Round((to - DateTime.UtcNow).TotalMinutes);
    private int LocalOffsetMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
    private DateTime Today => DateTime.UtcNow.AddMinutes(LocalOffsetMinutes).Date.AddMinutes(-LocalOffsetMinutes);

    public async Task<PagedResult<OccupantDto>> GetOccupantsAsync(Guid libraryId, OccupantListParams p, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var s = await settings.GetAsync(libraryId, ct);
        var paged = await uow.LibrarySessions.GetOccupantsPagedAsync(libraryId, p, ct);
        var seatFloor = SeatFloorResolver(await uow.Libraries.GetByIdAsync(libraryId, ct));
        return Map(paged, x => MapOccupant(x, s, seatFloor));
    }

    public async Task<PagedResult<AllLibrariesPersonDto>> GetAllLibrariesPersonsAsync(AllLibrariesPersonListParams p, CancellationToken ct)
    {
        IReadOnlyCollection<Guid>? scopedLibraryIds = current.Id is Guid suid
            ? await userScope.GetScopedRefIdsAsync(suid, "library", ct)
            : null;

        if (string.Equals(p.Status, "waiting", StringComparison.OrdinalIgnoreCase))
        {
            var pagedQueue = await uow.LibraryQueue.GetAllWaitingPagedAsync(p, scopedLibraryIds, ct);
            var libNamesQ = await GetLibraryNamesAsync(pagedQueue.Items.Select(x => x.LibraryId), ct);
            return Map(pagedQueue, x => MapAllLibrariesQueue(x, libNamesQ));
        }

        var statusFilter = string.Equals(p.Status, "onBreak", StringComparison.OrdinalIgnoreCase) ? "onBreak"
            : string.Equals(p.Status, "inside", StringComparison.OrdinalIgnoreCase) ? "inside"
            : null;
        var paged = await uow.LibrarySessions.GetAllOccupantsPagedAsync(statusFilter, p, scopedLibraryIds, ct);
        var libNames = await GetLibraryNamesAsync(paged.Items.Select(x => x.LibraryId), ct);
        var labelers = await GetSeatLabelersAsync(paged.Items.Select(x => x.LibraryId), ct);
        return Map(paged, x => MapAllLibrariesOccupant(x, libNames, labelers));
    }

    private async Task<Dictionary<Guid, string>> GetLibraryNamesAsync(IEnumerable<Guid> libraryIds, CancellationToken ct)
    {
        var ids = libraryIds.Distinct().ToList();
        var result = new Dictionary<Guid, string>();
        foreach (var id in ids)
        {
            var lib = await uow.Libraries.GetByIdAsync(id, ct);
            if (lib is not null) result[id] = lib.Name;
        }
        return result;
    }

    private async Task<Dictionary<Guid, Func<string?, string?>>> GetSeatLabelersAsync(IEnumerable<Guid> libraryIds, CancellationToken ct)
    {
        var ids = libraryIds.Distinct().ToList();
        var result = new Dictionary<Guid, Func<string?, string?>>();
        foreach (var id in ids)
        {
            result[id] = SeatLabeler(await uow.Libraries.GetByIdAsync(id, ct));
        }
        return result;
    }

    private static AllLibrariesPersonDto MapAllLibrariesOccupant(LibrarySession x, Dictionary<Guid, string> libNames, Dictionary<Guid, Func<string?, string?>> labelers)
        => new(
            x.Id.ToString(),
            x.LibraryId.ToString(),
            libNames.GetValueOrDefault(x.LibraryId, ""),
            (x.ParticipantId ?? x.Id).ToString(),
            x.MemberName,
            labelers.TryGetValue(x.LibraryId, out var lbl) ? lbl(x.Seat) : x.Seat,
            x.EntryTime,
            MinutesSince(x.EntryTime),
            LibrarySessionStatus.IsOnBreak(x.Status) ? "onBreak" : "inside");

    private static AllLibrariesPersonDto MapAllLibrariesQueue(LibraryQueueEntry x, Dictionary<Guid, string> libNames)
        => new(
            x.Id.ToString(),
            x.LibraryId.ToString(),
            libNames.GetValueOrDefault(x.LibraryId, ""),
            x.Id.ToString(),
            x.MemberName,
            null,
            x.JoinedAt,
            MinutesSince(x.JoinedAt),
            "waiting");

    public async Task<PagedResult<QueueEntryDto>> GetQueueAsync(Guid libraryId, QueueListParams p, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var paged = await uow.LibraryQueue.GetPagedAsync(libraryId, p, ct);
        return Map(paged, MapQueue);
    }

    public async Task<PagedResult<LibraryBreakDto>> GetBreaksAsync(Guid libraryId, BreakListParams p, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var paged = await uow.LibraryBreaks.GetActivePagedAsync(libraryId, p, ct);
        var seatFloor = SeatFloorResolver(await uow.Libraries.GetByIdAsync(libraryId, ct));
        return Map(paged, x => MapBreak(x, seatFloor));
    }

    public async Task<PagedResult<ExitedSessionDto>> GetExitedAsync(Guid libraryId, ExitedListParams p, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var date = DateTime.TryParse(p.Date, out var d) ? d.Date.AddMinutes(-LocalOffsetMinutes) : Today;
        var paged = await uow.LibrarySessions.GetExitedPagedAsync(libraryId, date, p, ct);
        var seatFloor = SeatFloorResolver(await uow.Libraries.GetByIdAsync(libraryId, ct));
        return Map(paged, x => MapExited(x, seatFloor));
    }

    public async Task<LibraryCheckInResultDto> CheckInAsync(Guid libraryId, LibraryCheckInRequest req, CancellationToken ct)
        => await CheckInAsync(libraryId, req, true, ct);

    public async Task<LibraryCheckInResultDto> CheckInAsync(Guid libraryId, LibraryCheckInRequest req, bool triggerDoor, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var dto = await CheckInCoreAsync(libraryId, req, triggerDoor, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return dto;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<LibraryCheckInResultDto> CheckInCoreAsync(Guid libraryId, LibraryCheckInRequest req, bool triggerDoor, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);

        var library = await GetLibraryAsync(libraryId, ct);
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);
        EnforceEntryMethod(library, req.Method);

        var s = await settings.GetAsync(libraryId, ct);
        var m = await ResolveMemberAsync(req.ParticipantId, req.Tckn, req.MemberName, req.Phone, req.BirthDate, req.GuardianPhone, ct);

        await EnforceSingleActiveAsync(m.ParticipantId, m.Tckn, libraryId, ct);
        await EnforceDailyVisitCapAsync(m.ParticipantId, m.Tckn, libraryId, s, ct);

        if (s.BlockEntryOnOverdue && !string.IsNullOrWhiteSpace(m.Tckn))
        {
            var preEntryOverdue = await emanet.GetOverdueAsync(m.Tckn, ct);
            if (preEntryOverdue.HasOverdue)
            {
                await notify.NotifyStaffOverdueAsync(libraryId, m.Name, preEntryOverdue.Count, ct);
                throw new ConflictException(
                    $"{m.Name} teslim tarihi geçmiş {preEntryOverdue.Count} emanet/kitabı olduğu için giriş yapamaz. Lütfen önce iade edin.",
                    "MEMBER_HAS_OVERDUE_ITEMS");
            }
        }

        var reservation = await ResolveHeldReservationAsync(m.ParticipantId, m.Tckn, libraryId, ct);

        var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
        if (inside >= library.Capacity)
        {
            if (!library.QueueEnabled)
                throw new ConflictException("Kıraathane dolu.", "LIBRARY_FULL");

            var seq = await uow.LibraryQueue.NextQueueSeqAsync(libraryId, Today, ct);
            var queueNumber = $"Q-{seq:D3}";
            var entry = LibraryQueueEntry.Create(libraryId, queueNumber, m.ParticipantId, m.Name, m.Tckn, m.Phone ?? "", m.BirthDate, m.GuardianPhone, NormalizeMethod(req.Method));
            await uow.LibraryQueue.AddAsync(entry, ct);
            await uow.SaveChangesAsync(ct);
            await LogAsync(AuditAction.CheckIn, "LibraryQueueEntry", entry.Id, $"Kıraathane dolu, kuyruğa alındı: {m.Name} ({queueNumber})", ct);
            await BroadcastOccupancyAsync(libraryId, ct);
            return new LibraryCheckInResultDto(false, true, null, queueNumber, "Kıraathane dolu, kuyruğa alındınız.");
        }

        var seat = reservation?.Seat ?? req.Seat;
        if (library.SeatingMode == "masali" && string.IsNullOrWhiteSpace(seat))
            throw new ConflictException("Masalı sistemde koltuk seçimi zorunludur.", "SEAT_REQUIRED");
        if (library.SeatingMode == "sirali") seat = null;

        await EnsureSeatAvailableAsync(library, seat, m.ParticipantId, m.Tckn, ct);

        var session = LibrarySession.Create(libraryId, m.ParticipantId, m.Name, m.Tckn, m.Phone, m.BirthDate, m.GuardianPhone, seat, reservation?.Id, NormalizeMethod(req.Method));
        // Kod denetimi 2026-10-06: aynı atomiklik düzeltmesi — kapı açılamadan hiçbir oturum
        // kaydı yazılmamalı. Id client-side üretilmiş GUID olduğu için SaveChangesAsync beklemeden
        // kullanılabilir.
        if (triggerDoor)
            await TriggerDoorAsync(library, session.Id, "entry", m.Name, ct);
        await uow.LibrarySessions.AddAsync(session, ct);
        if (reservation is not null) { reservation.Consume(); uow.LibraryReservations.Update(reservation); }

        if (m.ParticipantId is Guid enteredPid)
        {
            var queueEntry = await uow.LibraryQueue.GetActiveByParticipantAsync(enteredPid, libraryId, ct);
            if (queueEntry is not null)
            {
                queueEntry.Enter();
                uow.LibraryQueue.Update(queueEntry);
            }
        }

        await uow.SaveChangesAsync(ct);

        EmanetOverdueResult? overdue = null;
        if (!s.BlockEntryOnOverdue && !string.IsNullOrWhiteSpace(m.Tckn))
        {
            overdue = await emanet.GetOverdueAsync(m.Tckn, ct);
            if (overdue.HasOverdue)
                await notify.NotifyStaffOverdueAsync(libraryId, m.Name, overdue.Count, ct);
        }

        await LogAsync(AuditAction.CheckIn, "LibrarySession", session.Id, $"Kıraathane girişi: {m.Name}", ct);
        if (!s.RequiresEntryAndExit)
            await TryAwardLibraryPointsAsync(session, libraryId, ct);
        await BroadcastOccupancyAsync(libraryId, ct);
        return new LibraryCheckInResultDto(true, false, seat, null, "Giriş kaydedildi.",
            overdue?.Count ?? 0, overdue is { HasOverdue: true } ? overdue.Books : null);
    }

    private async Task TriggerDoorAsync(Library library, Guid sessionId, string direction, string memberName, CancellationToken ct)
    {
        var dirText = direction == "exit" ? "çıkış" : "giriş";

        var devices = await uow.LibraryDevices.GetByLibraryAsync(library.Id, ct);
        var device = devices.FirstOrDefault(d => d.IsActive && (d.OperationMode == "toggle" || d.Direction == direction));
        if (device is null) return;
        if (!device.TriggerLockOnSuccess) return;

        DoorTriggerResult result;
        if (device.WorkMode == "online")
        {
            result = DoorTriggerResult.Success();
        }
        else
        {
            var lockResult = await locks.TriggerAsync(device, direction, ct);
            result = lockResult.Opened
                ? DoorTriggerResult.Success()
                : DoorTriggerResult.Failure(lockResult.ErrorCode ?? "DOOR_TRIGGER_FAILED", lockResult.ErrorMessage ?? "Kilit tetiklenemedi.");
        }

        if (result.Opened)
        {
            await LogAsync(AuditAction.Update, "LibraryDoorSignal", sessionId,
                $"Kapı/turnike açıldı ({dirText}): {memberName}", ct);
            return;
        }

        await LogAsync(AuditAction.Update, "LibraryDoorSignal", sessionId,
            $"Kapı/turnike AÇILAMADI ({dirText}): {memberName} — {result.ErrorMessage}", ct);

        if (direction == "entry")
        {
            var session = await uow.LibrarySessions.GetByIdAsync(sessionId, ct);
            if (session is not null)
            {
                session.MarkDeviceError();
                uow.LibrarySessions.Update(session);
                await uow.SaveChangesAsync(ct);
            }
            throw new ConflictException(result.ErrorMessage ?? "Kapı/turnike açılamadı. Lütfen görevliye başvurun.", result.ErrorCode ?? "DOOR_TRIGGER_FAILED");
        }
    }

    public async Task StartBreakAsync(Guid sessionId, StartBreakRequest req, CancellationToken ct)
    {
        var session = await uow.LibrarySessions.GetByIdAsync(sessionId, ct)
            ?? throw new NotFoundException("Oturum bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(session.LibraryId, ct);
        if (session.Status != LibrarySessionStatus.Inside)
            throw new ConflictException("Üye şu anda içeride değil.", "NOT_INSIDE");
        EnforceNotOpenType(await GetLibraryAsync(session.LibraryId, ct));

        var s = await settings.GetAsync(session.LibraryId, ct);
        var type = req.Type == "long" ? "long" : "short";
        var now = DateTime.UtcNow;

        if (!await templateEngine.IsBreakSystemEnabledAsync(session.LibraryId, ct))
            throw new ConflictException("Bu kıraathanede mola sistemi kullanılmıyor.", "BREAK_SYSTEM_DISABLED");

        int duration;
        if (type == "long")
        {
            if (s.MaxDailyLongBreaks > 0)
            {
                var longToday = await uow.LibraryBreaks.CountTodayBySessionTypeAsync(sessionId, "long", Today, ct);
                if (longToday >= s.MaxDailyLongBreaks)
                    throw new ConflictException(
                        s.MaxDailyLongBreaks == 1
                            ? "Günde yalnızca bir uzun mola kullanabilirsiniz."
                            : $"Günlük uzun mola hakkınız doldu (en fazla {s.MaxDailyLongBreaks}).",
                        "LONG_BREAK_LIMIT");
            }
            duration = s.LongBreakDurationMinutes;
        }
        else
        {
            if (!DisableBreakTimingRules)
            {
                var minEntryBeforeBreak = s.MinEntryBeforeBreakMinutes;
                if (minEntryBeforeBreak > 0 && (now - session.EntryTime).TotalMinutes < minEntryBeforeBreak)
                {
                    var wait = (int)Math.Ceiling(minEntryBeforeBreak - (now - session.EntryTime).TotalMinutes);
                    throw new ConflictException($"Kısa mola için en az {minEntryBeforeBreak} dakika içeride olmanız gerekiyor. Yaklaşık {wait} dakika sonra mola alabilirsiniz.", "TOO_SOON_FOR_BREAK");
                }

                var cooldown = s.ShortBreakCooldownMinutes > 0 ? s.ShortBreakCooldownMinutes : BreakIntervalMinutes;
                var lastShortStart = await uow.LibraryBreaks.GetLastBreakStartByTypeTodayAsync(sessionId, "short", Today, ct);
                if (lastShortStart is DateTime ls && (now - ls).TotalMinutes < cooldown)
                {
                    var wait = (int)Math.Ceiling(cooldown - (now - ls).TotalMinutes);
                    throw new ConflictException($"İki kısa mola arasında en az {cooldown} dakika olmalı. Yaklaşık {wait} dakika sonra tekrar mola alabilirsiniz.", "BREAK_TOO_SOON");
                }
            }

            if (s.MaxDailyBreaks > 0)
            {
                var shortToday = await uow.LibraryBreaks.CountTodayBySessionTypeAsync(sessionId, "short", Today, ct);
                if (shortToday >= s.MaxDailyBreaks)
                    throw new ConflictException("Günlük kısa mola hakkınız doldu.", "BREAK_LIMIT_REACHED");
            }
            duration = s.BreakDurationMinutes;
        }

        var brk = LibraryBreak.Create(session.LibraryId, sessionId, session.ParticipantId, session.MemberName, type, session.Seat, duration, s.BreakReturnGraceMinutes);
        await uow.LibraryBreaks.AddAsync(brk, ct);
        session.StartBreak(type);
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);

        await LogAsync(AuditAction.Update, "LibraryBreak", brk.Id, $"Mola başladı ({type}): {session.MemberName}", ct);
        await BroadcastOccupancyAsync(session.LibraryId, ct);
    }

    public async Task EndBreakAsync(Guid breakId, CancellationToken ct)
    {
        var brk = await uow.LibraryBreaks.GetByIdAsync(breakId, ct)
            ?? throw new NotFoundException("Mola bulunamadı.", "BREAK_NOT_FOUND");
        await EnsureInScopeAsync(brk.LibraryId, ct);
        if (brk.Status != "active")
            throw new ConflictException("Mola zaten sonlanmış.", "BREAK_ALREADY_ENDED");

        brk.End();
        uow.LibraryBreaks.Update(brk);
        var session = await uow.LibrarySessions.GetByIdAsync(brk.SessionId, ct);
        if (session is not null && LibrarySessionStatus.IsOnBreak(session.Status)) { session.EndBreak(); uow.LibrarySessions.Update(session); }
        await uow.SaveChangesAsync(ct);

        await LogAsync(AuditAction.Update, "LibraryBreak", brk.Id, $"Mola bitti: {brk.MemberName}", ct);
        if (session is not null) await BroadcastOccupancyAsync(session.LibraryId, ct);
    }

    public async Task ExitAsync(Guid sessionId, CancellationToken ct)
        => await ExitAsync(sessionId, false, ct);

    public async Task ExitAsync(Guid sessionId, bool byStaff, CancellationToken ct)
        => await ExitAsync(sessionId, byStaff, true, ct);

    public async Task ExitAsync(Guid sessionId, bool byStaff, bool triggerDoor, CancellationToken ct)
    {
        var session = await uow.LibrarySessions.GetByIdAsync(sessionId, ct)
            ?? throw new NotFoundException("Oturum bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(session.LibraryId, ct);
        if (!LibrarySessionStatus.IsActive(session.Status))
            throw new ConflictException("Üye zaten çıkış yapmış.", "ALREADY_EXITED");

        var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(sessionId, ct);
        if (brk is not null) { brk.End(); uow.LibraryBreaks.Update(brk); }

        if (byStaff) session.CloseByStaff(); else session.Exit(false);
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);

        var s = await settings.GetAsync(session.LibraryId, ct);
        if (s.RequiresEntryAndExit)
            await TryAwardLibraryPointsAsync(session, session.LibraryId, ct);

        await notify.NotifyGuardianOnExitAsync(session.LibraryId, (await uow.Libraries.GetByIdAsync(session.LibraryId, ct))?.Name ?? "", session.MemberName, session.BirthDate, session.GuardianPhone, ct);
        var logText = byStaff ? $"Görevli oturumu sonlandırdı: {session.MemberName}" : $"Kıraathane çıkışı: {session.MemberName}";
        await LogAsync(AuditAction.CheckOut, "LibrarySession", session.Id, logText, ct);

        if (triggerDoor)
        {
            var library = await uow.Libraries.GetByIdAsync(session.LibraryId, ct);
            if (library is not null)
                await TriggerDoorAsync(library, session.Id, "exit", session.MemberName, ct);
        }

        await TryPromoteQueueAsync(session.LibraryId, ct);
        await BroadcastOccupancyAsync(session.LibraryId, ct);
    }

    public async Task ChangeSeatAsync(Guid sessionId, ChangeSeatRequest req, CancellationToken ct)
    {
        var session = await uow.LibrarySessions.GetByIdAsync(sessionId, ct)
            ?? throw new NotFoundException("Oturum bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(session.LibraryId, ct);
        session.ChangeSeat(string.IsNullOrWhiteSpace(req.Seat) ? null : req.Seat.Trim());
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "LibrarySession", session.Id, $"Koltuk değişti: {session.MemberName} → {session.Seat}", ct);
    }

    public async Task CallNextAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        await GetLibraryAsync(libraryId, ct);

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        Domain.Entities.Libraries.LibraryQueueEntry front;
        try
        {
            await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);

            if (await uow.LibraryQueue.HasCalledAsync(libraryId, ct))
                throw new ConflictException("Çağrılan kişi var; önce onu sonlandırın.", "QUEUE_ALREADY_CALLED");
            front = await uow.LibraryQueue.GetFrontWaitingAsync(libraryId, ct)
                ?? throw new ConflictException("Sırada bekleyen yok.", "QUEUE_EMPTY");

            front.Call(Math.Max(1, QueueCallWindowMinutes));
            uow.LibraryQueue.Update(front);
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await LogAsync(AuditAction.Update, "LibraryQueueEntry", front.Id, $"Sıra başı çağrıldı: {front.MemberName}", ct);
    }

    public async Task MarkEnteredAsync(Guid queueId, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await MarkEnteredCoreAsync(queueId, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task MarkEnteredCoreAsync(Guid queueId, CancellationToken ct)
    {
        var entry = await uow.LibraryQueue.GetByIdAsync(queueId, ct)
            ?? throw new NotFoundException("Kuyruk kaydı bulunamadı.", "QUEUE_NOT_FOUND");
        await EnsureInScopeAsync(entry.LibraryId, ct);
        await uow.AcquireAdvisoryLockAsync(LibraryLockKey(entry.LibraryId), ct);

        if (entry.Status != "waiting" && entry.Status != "called")
            throw new ConflictException("Bu kuyruk kaydı işleme uygun değil.", "QUEUE_INVALID_STATE");

        var library = await GetLibraryAsync(entry.LibraryId, ct);
        var inside = await uow.LibrarySessions.CountInsideAsync(entry.LibraryId, ct);
        if (inside >= library.Capacity)
            throw new ConflictException("Kıraathane hâlâ dolu.", "LIBRARY_FULL");

        var reservation = entry.ParticipantId is Guid pid
            ? await uow.LibraryReservations.GetActiveHoldByParticipantAsync(pid, ct)
            : !string.IsNullOrWhiteSpace(entry.Tckn) ? await uow.LibraryReservations.GetHeldByTcknLibraryAsync(entry.Tckn, entry.LibraryId, ct) : null;
        if (reservation is not null && (reservation.LibraryId != entry.LibraryId || reservation.HoldUntil < DateTime.UtcNow))
            reservation = null;

        await EnsureSeatAvailableAsync(library, reservation?.Seat, entry.ParticipantId, entry.Tckn, ct);

        entry.Enter();
        uow.LibraryQueue.Update(entry);
        var session = LibrarySession.Create(entry.LibraryId, entry.ParticipantId, entry.MemberName, entry.Tckn, entry.Phone, entry.BirthDate, entry.GuardianPhone, reservation?.Seat, reservation?.Id, entry.Method);
        await uow.LibrarySessions.AddAsync(session, ct);
        if (reservation is not null) { reservation.Consume(); uow.LibraryReservations.Update(reservation); }
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.CheckIn, "LibrarySession", session.Id, $"Kuyruktan giriş: {entry.MemberName}", ct);
        await TriggerDoorAsync(library, session.Id, "entry", entry.MemberName, ct);
        await BroadcastOccupancyAsync(entry.LibraryId, ct);
    }

    public async Task ExpireQueueAsync(Guid queueId, CancellationToken ct)
    {
        var entry = await uow.LibraryQueue.GetByIdAsync(queueId, ct)
            ?? throw new NotFoundException("Kuyruk kaydı bulunamadı.", "QUEUE_NOT_FOUND");
        await EnsureInScopeAsync(entry.LibraryId, ct);
        entry.Expire();
        uow.LibraryQueue.Update(entry);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "LibraryQueueEntry", entry.Id, $"Kuyruktan düşürüldü: {entry.MemberName}", ct);
        await BroadcastOccupancyAsync(entry.LibraryId, ct);
    }

    public async Task WarnAsync(Guid memberId, WarnRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
            throw new ConflictException("Uyarı mesajı boş olamaz.", "WARN_MESSAGE_REQUIRED");
        var session = await uow.LibrarySessions.GetByIdAsync(memberId, ct)
            ?? await uow.LibrarySessions.GetActiveByParticipantAsync(memberId, ct)
            ?? throw new NotFoundException("Üye oturumu bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(session.LibraryId, ct);
        var warnLibraryName = (await uow.Libraries.GetByIdAsync(session.LibraryId, ct))?.Name ?? "";
        await notify.NotifyMemberWarnAsync(session.LibraryId, warnLibraryName, "manual", session.ParticipantId, session.Phone, session.MemberName, req.Message.Trim(), ct);
        await LogAsync(AuditAction.Update, "LibrarySession", session.Id, $"Uyarı gönderildi: {session.MemberName}", ct);
    }

    public async Task<LibraryReservationResultDto> CreateReservationAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var dto = await CreateReservationCoreAsync(libraryId, req, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return dto;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<LibraryReservationResultDto> CreateReservationCoreAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);

        var library = await GetLibraryAsync(libraryId, ct);
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);
        if (!library.ReservationEnabled)
            throw new ConflictException("Bu kıraathanede rezervasyon kapalı.", "RESERVATION_DISABLED");

        var s = await settings.GetAsync(libraryId, ct);
        if (req.SlotStart is DateTime slot && slot.Date != TurkeyTime.TodayDate())
            throw new ConflictException("Rezervasyon yalnızca bugün için yapılabilir.", "RESERVATION_NOT_TODAY");

        var m = await ResolveMemberAsync(req.ParticipantId, req.Tckn, req.MemberName, req.Phone, req.BirthDate, req.GuardianPhone, ct);

        await EnforceSingleActiveAsync(m.ParticipantId, m.Tckn, libraryId, ct);
        var existingHold = m.ParticipantId is Guid pid
            ? await uow.LibraryReservations.GetActiveHoldByParticipantAsync(pid, ct)
            : !string.IsNullOrWhiteSpace(m.Tckn) ? await uow.LibraryReservations.GetActiveHoldByTcknAsync(m.Tckn, ct) : null;
        if (existingHold is not null)
            throw new ConflictException("Aktif bir rezervasyonunuz var. Önce onu iptal edin veya kullanın.", "RESERVATION_ACTIVE");
        await EnforceReservationForfeitAsync(m.ParticipantId, m.Tckn, libraryId, ct);
        await EnforceDailyReservationLimitAsync(m.ParticipantId, libraryId, s, ct);

        var seat = req.Seat;
        if (library.SeatingMode == "masali" && string.IsNullOrWhiteSpace(seat))
            throw new ConflictException("Masalı sistemde koltuk seçimi zorunludur.", "SEAT_REQUIRED");

        await EnsureSeatAvailableAsync(library, seat, m.ParticipantId, m.Tckn, ct);

        var startRef = req.SlotStart ?? DateTime.UtcNow;
        var slotEnd = s.MaxStudyHoursPerDay > 0 ? startRef.AddHours(s.MaxStudyHoursPerDay) : req.SlotEnd;

        var res = LibraryReservation.Create(libraryId, m.ParticipantId, m.Name, m.Tckn, m.Phone ?? "", m.BirthDate, m.GuardianPhone, seat, req.SlotStart, slotEnd, Math.Max(1, s.ReservationHoldWindowMinutes));
        await uow.LibraryReservations.AddAsync(res, ct);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Create, "LibraryReservation", res.Id, $"Rezervasyon oluşturuldu: {m.Name}", ct);

        return new LibraryReservationResultDto(res.Id.ToString(), res.Seat, res.HoldUntil, "Rezervasyon oluşturuldu. Belirtilen süre içinde QR ile giriş yapın.");
    }

    public async Task<LibraryReservationResultDto> WalkInAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var dto = await WalkInCoreAsync(libraryId, req, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return dto;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<LibraryReservationResultDto> WalkInCoreAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        await uow.AcquireAdvisoryLockAsync(LibraryLockKey(libraryId), ct);

        var library = await GetLibraryAsync(libraryId, ct);
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);
        var s = await settings.GetAsync(libraryId, ct);
        var m = await ResolveMemberAsync(req.ParticipantId, req.Tckn, req.MemberName, req.Phone, req.BirthDate, req.GuardianPhone, ct);

        await EnforceSingleActiveAsync(m.ParticipantId, m.Tckn, libraryId, ct);

        var existingHold = m.ParticipantId is Guid pidH
            ? await uow.LibraryReservations.GetActiveHoldByParticipantAsync(pidH, ct)
            : !string.IsNullOrWhiteSpace(m.Tckn) ? await uow.LibraryReservations.GetActiveHoldByTcknAsync(m.Tckn, ct) : null;
        if (existingHold is not null)
        {
            if (existingHold.LibraryId == libraryId && existingHold.HoldUntil > DateTime.UtcNow)
                return new LibraryReservationResultDto(existingHold.Id.ToString(), existingHold.Seat, existingHold.HoldUntil,
                    "Yeriniz ayrıldı. Belirtilen süre içinde QR ile giriş yapın.");
            throw new ConflictException("Aktif bir yer ayırtmanız var. Önce onu kullanın veya iptal edin.", "RESERVATION_ACTIVE");
        }

        var calledQueue = m.ParticipantId is Guid pidC ? await uow.LibraryQueue.GetActiveByParticipantAsync(pidC, libraryId, ct) : null;
        var isCalled = calledQueue is { Status: "called" } && (calledQueue.CountdownExpiresAt is null || calledQueue.CountdownExpiresAt > DateTime.UtcNow);

        var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
        if (!isCalled && inside >= library.Capacity)
            throw new ConflictException("Kıraathane dolu. Lütfen sıraya katılın.", "LIBRARY_FULL_JOIN_QUEUE");

        var seat = req.Seat;
        if (library.SeatingMode == "masali" && string.IsNullOrWhiteSpace(seat))
            throw new ConflictException("Boş bir koltuk seçmelisiniz.", "SEAT_REQUIRED");
        if (library.SeatingMode == "sirali") seat = null;

        await EnsureSeatAvailableAsync(library, seat, m.ParticipantId, m.Tckn, ct);

        var res = LibraryReservation.Create(libraryId, m.ParticipantId, m.Name, m.Tckn, m.Phone ?? "", m.BirthDate, m.GuardianPhone, seat, DateTime.UtcNow, null, Math.Max(1, s.WalkInHoldMinutes), isWalkIn: true);
        await uow.LibraryReservations.AddAsync(res, ct);
        if (isCalled && calledQueue is not null) { calledQueue.Enter(); uow.LibraryQueue.Update(calledQueue); }
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Create, "LibraryReservation", res.Id, $"Walk-in yer ayırma: {m.Name}", ct);

        return new LibraryReservationResultDto(res.Id.ToString(), res.Seat, res.HoldUntil, "Yeriniz ayrıldı. Belirtilen süre içinde QR ile giriş yapın.");
    }

    private static long LibraryLockKey(Guid libraryId) => BitConverter.ToInt64(libraryId.ToByteArray(), 0);

    public async Task CancelReservationAsync(Guid reservationId, CancellationToken ct)
    {
        var reservation = await uow.LibraryReservations.GetByIdAsync(reservationId, ct)
            ?? throw new NotFoundException("Rezervasyon bulunamadı.", "RESERVATION_NOT_FOUND");
        await EnsureInScopeAsync(reservation.LibraryId, ct);

        if (reservation.Status != "held")
            throw new ConflictException("Yalnızca bekleyen rezervasyonlar iptal edilebilir.", "RESERVATION_NOT_CANCELABLE");

        reservation.Cancel();
        uow.LibraryReservations.Update(reservation);
        await uow.SaveChangesAsync(ct);

        var library = await GetLibraryAsync(reservation.LibraryId, ct);
        await notify.NotifyReservationCancelledAsync(reservation.LibraryId, reservation.ParticipantId, reservation.Phone, reservation.MemberName, library.Name, byStaff: true, ct);

        await LogAsync(AuditAction.Cancel, "LibraryReservation", reservation.Id, $"Rezervasyon yönetici tarafından iptal edildi: {reservation.MemberName}", ct);
        await BroadcastOccupancyAsync(reservation.LibraryId, ct);
    }

    public async Task<int> JoinQueueAsync(Guid libraryId, LibraryReservationRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);
        if (!library.QueueEnabled)
            throw new ConflictException("Bu kıraathanede sıra sistemi kapalı.", "QUEUE_DISABLED");
        var m = await ResolveMemberAsync(req.ParticipantId, req.Tckn, req.MemberName, req.Phone, req.BirthDate, req.GuardianPhone, ct);

        await EnforceSingleActiveAsync(m.ParticipantId, m.Tckn, libraryId, ct);

        if (m.ParticipantId is Guid pid)
        {
            var already = await uow.LibraryQueue.GetActiveByParticipantAsync(pid, libraryId, ct);
            if (already is not null)
                return await WaitingPositionAsync(libraryId, already.Id, ct);

            var otherQueue = await uow.LibraryQueue.GetActiveByParticipantAnyAsync(pid, ct);
            if (otherQueue is not null)
            {
                var other = await GetLibraryAsync(otherQueue.LibraryId, ct);

                if (otherQueue.Status == "called")
                {
                    var minutesLeft = otherQueue.CountdownExpiresAt is DateTime exp
                        ? (int)Math.Max(0, Math.Ceiling((exp - DateTime.UtcNow).TotalMinutes))
                        : 0;
                    var within = minutesLeft > 0 ? $"{minutesLeft} dakika içinde" : "hemen";
                    throw new ConflictException(
                        $"{other.Name} kıraathanesinde sıranız geldi ve giriş bekleniyor. Lütfen {within} oraya giderek QR kodunuzu okutun. Vazgeçtiyseniz önce {other.Name} sırasından ayrılın, sonra buraya katılabilirsiniz.",
                        "QUEUE_ACTIVE_ELSEWHERE");
                }

                var position = await WaitingPositionAsync(otherQueue.LibraryId, otherQueue.Id, ct);
                var positionText = position > 0 ? $" ve {position}. sıradasınız" : "";
                throw new ConflictException(
                    $"{other.Name} kıraathanesinin sırasında bekliyorsunuz{positionText}. Aynı anda yalnızca bir sırada bekleyebilirsiniz. Buraya katılmak için önce {other.Name} sırasından ayrılın.",
                    "QUEUE_ACTIVE_ELSEWHERE");
            }

            var hold = await uow.LibraryReservations.GetActiveHoldByParticipantAsync(pid, ct);
            if (hold is not null)
                throw new ConflictException("Aktif bir yer ayırtmanız var. Önce onu kullanın.", "RESERVATION_ACTIVE");
        }

        var inside = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);
        if (inside < library.Capacity)
            throw new ConflictException("Şu an boş yer var, doğrudan giriş yapabilirsiniz.", "SPACE_AVAILABLE");

        var seq = await uow.LibraryQueue.NextQueueSeqAsync(libraryId, Today, ct);
        var entry = LibraryQueueEntry.Create(libraryId, $"Q-{seq:D3}", m.ParticipantId, m.Name, m.Tckn, m.Phone ?? "", m.BirthDate, m.GuardianPhone, "self");
        await uow.LibraryQueue.AddAsync(entry, ct);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Create, "LibraryQueueEntry", entry.Id, $"Sıraya katıldı: {m.Name}", ct);
        await BroadcastOccupancyAsync(libraryId, ct);

        return await WaitingPositionAsync(libraryId, entry.Id, ct);
    }

    public async Task LeaveQueueAsync(Guid libraryId, Guid participantId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var entry = await uow.LibraryQueue.GetActiveByParticipantAsync(participantId, libraryId, ct)
            ?? throw new NotFoundException("Sırada kaydınız bulunamadı.", "QUEUE_NOT_FOUND");
        entry.Cancel();
        uow.LibraryQueue.Update(entry);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Cancel, "LibraryQueueEntry", entry.Id, $"Sıradan ayrıldı: {entry.MemberName}", ct);
        await TryPromoteQueueAsync(libraryId, ct);
        await BroadcastOccupancyAsync(libraryId, ct);
    }

    private async Task<int> WaitingPositionAsync(Guid libraryId, Guid entryId, CancellationToken ct)
    {
        var ordered = await uow.LibraryQueue.GetActiveOrderedAsync(libraryId, ct);
        var waiting = ordered.Where(x => x.Status == "waiting").ToList();
        var idx = waiting.FindIndex(x => x.Id == entryId);
        return idx >= 0 ? idx + 1 : 0;
    }

    public async Task<LibrarySeatPlanDto> GetSeatPlanAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        var layout = DeserializeLayout(library.LayoutJson);
        var maintenance = DeserializeMaintenance(library.SeatStatesJson);

        var sessions = await uow.LibrarySessions.GetActiveByLibraryAsync(libraryId, ct);
        var reservations = await uow.LibraryReservations.GetActiveHoldsByLibraryAsync(libraryId, ct);

        var occBySeat = sessions
            .Where(x => !string.IsNullOrWhiteSpace(x.Seat))
            .GroupBy(x => x.Seat!)
            .ToDictionary(g => g.Key, g => g.First());
        var resBySeat = reservations
            .Where(x => !string.IsNullOrWhiteSpace(x.Seat))
            .GroupBy(x => x.Seat!)
            .ToDictionary(g => g.Key, g => g.First());

        var sequential = library.SeatingMode != "masali";
        var fillRemaining = sequential ? sessions.Count : 0;
        var breakRemaining = sequential ? sessions.Count(x => LibrarySessionStatus.IsOnBreak(x.Status)) : 0;

        var floors = new List<SeatFloorDto>();
        int total = 0, occupied = 0, onBreak = 0, onBreakShort = 0, onBreakLong = 0, reserved = 0, maintenanceCount = 0;

        SeatDto BuildKeyedSeat(string key, string label, int n)
        {
            total++;
            if (maintenance.Contains(key)) { maintenanceCount++; return new SeatDto(key, label, n, "maintenance", null, null, null, null); }
            if (occBySeat.TryGetValue(key, out var session))
            {
                var st = LibrarySessionStatus.IsOnBreak(session.Status) ? "on_break" : "occupied";
                if (st == "occupied") { occupied++; return new SeatDto(key, label, n, st, session.MemberName, session.EntryTime, null, session.Id.ToString()); }
                onBreak++;
                var breakType = session.Status == LibrarySessionStatus.OnBreakLong ? "long" : "short";
                if (breakType == "long") onBreakLong++; else onBreakShort++;
                return new SeatDto(key, label, n, st, session.MemberName, session.EntryTime, null, session.Id.ToString(), breakType);
            }
            if (resBySeat.TryGetValue(key, out var res)) { reserved++; return new SeatDto(key, label, n, "reserved", null, null, res.MemberName, null, null, res.Id.ToString()); }
            return new SeatDto(key, label, n, "available", null, null, null, null);
        }

        SeatDto BuildSequentialSeat(string key, string label, int n)
        {
            total++;
            if (maintenance.Contains(key)) { maintenanceCount++; return new SeatDto(key, label, n, "maintenance", null, null, null, null); }
            if (fillRemaining > 0)
            {
                fillRemaining--;
                if (breakRemaining > 0) { breakRemaining--; onBreak++; onBreakShort++; return new SeatDto(key, label, n, "on_break", null, null, null, null, "short"); }
                occupied++;
                return new SeatDto(key, label, n, "occupied", null, null, null, null);
            }
            return new SeatDto(key, label, n, "available", null, null, null, null);
        }

        foreach (var f in layout.Floors.Where(x => x.Active))
        {
            var floorSeats = new List<SeatDto>();
            List<SeatSectionDto>? sectionDtos = null;

            if (!sequential && f.Sections is { Count: > 0 })
            {
                sectionDtos = new List<SeatSectionDto>(f.Sections.Count);
                foreach (var sec in f.Sections)
                {
                    var secTables = sec.Tables ?? [];
                    var tableDtos = new List<SeatTableDto>(secTables.Count);
                    foreach (var tbl in secTables)
                    {
                        var tableSeats = new List<SeatDto>(Math.Max(0, tbl.SeatCount));
                        for (var n = 1; n <= tbl.SeatCount; n++)
                            tableSeats.Add(BuildKeyedSeat($"{f.Id}:{sec.Id}:{tbl.Id}:{n}", $"{tbl.Name} #{n}", n));
                        floorSeats.AddRange(tableSeats);
                        var tableOccupied = tableSeats.Count(s => s.Status is "occupied" or "on_break");
                        tableDtos.Add(new SeatTableDto(tbl.Id, tbl.Name, tbl.SeatCount, tableOccupied, tableSeats));
                    }
                    sectionDtos.Add(new SeatSectionDto(sec.Id, sec.Name, sec.Type, sec.Color, SeatStructure.SectionCapacity(sec), tableDtos));
                }
            }
            else
            {
                for (var n = 1; n <= f.Capacity; n++)
                {
                    var key = $"{f.Id}:{n}";
                    var label = $"{f.Name} #{n}";
                    floorSeats.Add(sequential ? BuildSequentialSeat(key, label, n) : BuildKeyedSeat(key, label, n));
                }
            }

            floors.Add(new SeatFloorDto(f.Id, f.Name, SeatStructure.FloorCapacity(f), f.Active, f.KrokiUrl, floorSeats, sectionDtos));
        }

        var available = total - occupied - onBreak - reserved - maintenanceCount;
        return new LibrarySeatPlanDto(library.SeatingMode, floors, total, occupied, onBreak, onBreakShort, onBreakLong, reserved, maintenanceCount, available);
    }

    public async Task SaveSeatMaintenanceAsync(Guid libraryId, SeatMaintenanceRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        var keys = (req.MaintenanceKeys ?? []).Where(k => !string.IsNullOrWhiteSpace(k)).Distinct().ToList();
        var dict = keys.ToDictionary(k => k, _ => "maintenance");
        library.SetSeatStates(dict.Count == 0 ? null : JsonSerializer.Serialize(dict, JsonOpts));
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id, $"Oturma planı bakım durumu güncellendi: {library.Name}", ct);
    }

    public async Task<LibrarySeatPlanDto> SaveSeatStructureAsync(Guid libraryId, SeatStructureRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        var floors = NormalizeStructure(library.SeatingMode, req.Floors ?? []);
        foreach (var f in floors)
            if (f.Sections is { Count: > 0 })
            {
                var allocated = f.Sections.Sum(s => s.Capacity);
                if (allocated > Math.Max(0, f.Capacity))
                    throw new ConflictException($"'{f.Name}' katında bölümlerin toplam kapasitesi ({allocated}) kat kontenjanını ({f.Capacity}) aşamaz.", "FLOOR_CAPACITY_EXCEEDED");
                foreach (var s in f.Sections)
                {
                    // Bulgu (2026-10-02): admin panelden Tables boş gönderilirse (yeni
                    // bölüm, masa eklenmeden kaydedilirse) null gelebiliyordu — aynı
                    // NRE sınıfı burada da kayıt anında 500 üretiyordu.
                    var used = (s.Tables ?? []).Sum(t => t.SeatCount);
                    if (used > s.Capacity)
                        throw new ConflictException($"'{s.Name}' bölümünde masaların toplam koltuğu ({used}) bölüm kapasitesini ({s.Capacity}) aşamaz.", "SECTION_CAPACITY_EXCEEDED");
                }
            }
        var capacity = SeatStructure.TotalCapacity(floors);
        var isMultiFloor = floors.Count > 1 || req.IsMultiFloor;
        var layoutJson = JsonSerializer.Serialize(new { isMultiFloor, floors }, JsonOpts);
        library.SetSeating(library.SeatingMode, capacity, floors.Count, isMultiFloor, layoutJson);
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id, $"Oturma planı yapısı güncellendi: {library.Name}", ct);
        return await GetSeatPlanAsync(libraryId, ct);
    }

    private static List<LibraryFloorDto> NormalizeStructure(string seatingMode, List<LibraryFloorDto> floors)
    {
        var masali = seatingMode == "masali";
        return floors.Select(f =>
        {
            var sections = masali && f.Sections is { Count: > 0 }
                ? f.Sections.Select(s =>
                {
                    // Bulgu (2026-10-02): bu normalize fonksiyonu tam olarak Tables=null
                    // gibi eksik veriyi temizlemek için var; null-safe olmazsa kendisi
                    // NRE fırlatıp kaydı hiç normalize edemiyordu.
                    var tables = (s.Tables ?? []).Select(t => t with { SeatCount = Math.Max(0, t.SeatCount) }).ToList();
                    var used = tables.Sum(t => t.SeatCount);
                    var cap = s.Capacity > 0 ? s.Capacity : used;
                    return s with { Capacity = cap, Tables = tables };
                }).ToList()
                : null;
            return f with { Capacity = Math.Max(0, f.Capacity), Sections = sections };
        }).ToList();
    }

    private static Func<string?, (string? Label, string? FloorId)> SeatFloorResolver(Library? library)
    {
        LibraryLayoutDto layout;
        try { layout = DeserializeLayout(library?.LayoutJson); }
        catch { layout = new LibraryLayoutDto(false, []); }
        return seatKey =>
        {
            if (string.IsNullOrWhiteSpace(seatKey)) return (seatKey, null);
            var parts = seatKey.Split(':');
            var seatNo = parts[^1];
            var floor = layout.Floors.FirstOrDefault(f => f.Id == parts[0]);
            string label;
            if (parts.Length >= 4 && floor?.Sections is { Count: > 0 } sections)
            {
                // Bulgu (2026-10-02): Tables null olduğunda (section henüz masa
                // eklenmemiş) ?. yalnızca section'ı korur, .Tables null olunca
                // FirstOrDefault çağrısı yine NRE fırlatırdı — koltuk etiketi
                // gösteren her yer (geçmiş, rezervasyonlarım) 500 alıyordu.
                var table = sections.FirstOrDefault(s => s.Id == parts[1])?.Tables?.FirstOrDefault(t => t.Id == parts[2]);
                label = table is not null ? $"{table.Name} · K{seatNo}" : $"Koltuk {seatNo}";
            }
            else
            {
                label = $"Koltuk {seatNo}";
            }
            var finalLabel = layout.IsMultiFloor && floor is not null ? $"{floor.Name} · {label}" : label;
            return (finalLabel, floor?.Id);
        };
    }

    private static Func<string?, string?> SeatLabeler(Library? library)
    {
        var resolver = SeatFloorResolver(library);
        return seatKey => resolver(seatKey).Label;
    }

    private static LibraryLayoutDto DeserializeLayout(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new LibraryLayoutDto(false, [])
            : JsonSerializer.Deserialize<LibraryLayoutDto>(json, JsonOpts) ?? new LibraryLayoutDto(false, []);

    private static HashSet<string> DeserializeMaintenance(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOpts);
        return dict is null ? [] : dict.Where(kv => kv.Value == "maintenance").Select(kv => kv.Key).ToHashSet();
    }

    private async Task EnforceSingleActiveAsync(Guid? participantId, string tckn, Guid libraryId, CancellationToken ct)
    {
        LibrarySession? active = null;
        if (participantId is Guid pid)
            active = await uow.LibrarySessions.GetActiveByParticipantAsync(pid, ct);
        else if (!string.IsNullOrWhiteSpace(tckn))
            active = await uow.LibrarySessions.GetActiveByTcknAsync(tckn, ct);
        if (active is not null)
            throw await ActiveSessionConflictAsync(active, libraryId, ct);
    }

    private async Task<ConflictException> ActiveSessionConflictAsync(LibrarySession session, Guid scannedLibraryId, CancellationToken ct)
    {
        var name = (await uow.Libraries.GetByIdAsync(session.LibraryId, ct))?.Name ?? "kıraathane";
        return session.LibraryId == scannedLibraryId
            ? new ConflictException($"Zaten {name} içindesiniz. Çıkmak için QR kodunuzu çıkış okuyucusuna okutun veya uygulamadan \"Oturumu Sonlandır\"a basın.", "ACTIVE_SESSION_EXISTS")
            : new ConflictException($"Şu an {name} içinde aktif oturumunuz var. Önce oradan çıkış yapın veya uygulamadan \"Oturumu Sonlandır\"a basın.", "ACTIVE_SESSION_ELSEWHERE");
    }

    private async Task EnforceDailyVisitCapAsync(Guid? participantId, string tckn, Guid libraryId, LibrarySettingsDto s, CancellationToken ct)
    {
        if (s.DailyVisitCap <= 0) return;

        var count = participantId is Guid pid
            ? await uow.LibrarySessions.CountTodayByParticipantLibraryAsync(pid, libraryId, Today, ct)
            : !string.IsNullOrWhiteSpace(tckn)
                ? await uow.LibrarySessions.CountTodayByTcknLibraryAsync(tckn, libraryId, Today, ct)
                : 0;

        if (count >= s.DailyVisitCap)
            throw new ConflictException("Bugünkü ziyaret hakkınızı kullandınız.", "DAILY_VISIT_CAP_REACHED");
    }

    private async Task EnforceDailyReservationLimitAsync(Guid? participantId, Guid libraryId, LibrarySettingsDto s, CancellationToken ct)
    {
        if (participantId is not Guid pid || s.DailyReservationLimitPerLibrary <= 0) return;
        var count = await uow.LibraryReservations.CountTodayByParticipantLibraryAsync(pid, libraryId, Today, ct);
        if (count >= s.DailyReservationLimitPerLibrary)
            throw new ConflictException("Bu kıraathane için günlük rezervasyon limitiniz doldu.", "DAILY_RESERVATION_LIMIT");
    }

    private async Task EnforceReservationForfeitAsync(Guid? participantId, string? tckn, Guid libraryId, CancellationToken ct)
    {
        var limit = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ReservationForfeitLimit", 3);
        if (limit <= 0) return;
        var windowDays = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ReservationForfeitWindowDays", 30);
        DateTime? since = windowDays > 0 ? DateTime.UtcNow.AddDays(-windowDays) : null;
        int forfeited;
        if (participantId is Guid pid)
            forfeited = await uow.LibraryReservations.CountForfeitedByParticipantAsync(pid, libraryId, since, ct);
        else if (!string.IsNullOrWhiteSpace(tckn))
            forfeited = await uow.LibraryReservations.CountForfeitedByTcknAsync(tckn, libraryId, since, ct);
        else
            return;
        if (forfeited >= limit)
            throw new ConflictException("Tekrarlanan iptal veya giriş yapmama nedeniyle bu kıraathane için rezervasyon hakkınız geçici olarak kapatıldı. Boş yer varsa doğrudan giriş yapabilirsiniz.", "RESERVATION_FORFEITED");
    }

    private async Task EnsureSeatAvailableAsync(Library library, string? seat, Guid? selfParticipantId, string? selfTckn, CancellationToken ct)
    {
        if (library.SeatingMode != "masali" || string.IsNullOrWhiteSpace(seat)) return;

        var activeSessions = await uow.LibrarySessions.GetActiveByLibraryAsync(library.Id, ct);
        if (activeSessions.Any(x => x.Seat == seat && LibrarySessionStatus.IsActive(x.Status)))
            throw new ConflictException("Bu koltuk şu anda dolu. Lütfen başka bir koltuk seçin.", "SEAT_ALREADY_TAKEN");

        var activeHolds = await uow.LibraryReservations.GetActiveHoldsByLibraryAsync(library.Id, ct);
        if (activeHolds.Any(h => h.Seat == seat && h.HoldUntil > DateTime.UtcNow && !IsSameMember(h, selfParticipantId, selfTckn)))
            throw new ConflictException("Bu koltuk şu anda başka biri için ayrılmış. Lütfen başka bir koltuk seçin.", "SEAT_ALREADY_TAKEN");
    }

    private static bool IsSameMember(LibraryReservation hold, Guid? participantId, string? tckn)
    {
        if (participantId is Guid pid && hold.ParticipantId == pid) return true;
        if (!string.IsNullOrWhiteSpace(tckn) && !string.IsNullOrWhiteSpace(hold.Tckn)
            && string.Equals(hold.Tckn, tckn, StringComparison.Ordinal)) return true;
        return false;
    }

    private async Task<LibraryReservation?> ResolveHeldReservationAsync(Guid? participantId, string tckn, Guid libraryId, CancellationToken ct)
    {
        LibraryReservation? res = null;
        if (participantId is Guid pid)
            res = await uow.LibraryReservations.GetActiveHoldByParticipantAsync(pid, ct);
        if (res is null && !string.IsNullOrWhiteSpace(tckn))
            res = await uow.LibraryReservations.GetActiveHoldByTcknAsync(tckn, ct);
        if (res is null) return null;
        if (res.LibraryId != libraryId)
            throw new ConflictException("Başka bir kıraathanede aktif rezervasyonunuz var.", "RESERVATION_OTHER_LIBRARY");
        if (res.HoldUntil < DateTime.UtcNow) { res.Expire(); uow.LibraryReservations.Update(res); return null; }
        return res;
    }

    private static void EnforceNotOpenType(Library library)
    {
        if (library.IsOpenType)
            throw new ConflictException("Bu kıraathane serbest kullanımlıdır; giriş-çıkış, oturum, mola, sıra veya rezervasyon işlemi yapılmaz.", "LIBRARY_OPEN_TYPE");
    }

    private static void EnforceEntryMethod(Library library, string? method)
    {
        var m = NormalizeMethod(method);
        if (library.EntryControlMode == "qr" && m != "qr")
            throw new ConflictException("Bu kıraathaneye yalnızca QR okuyucu ile giriş yapılabilir.", "QR_REQUIRED");
        if (library.EntryControlMode == "manual" && m == "qr")
            throw new ConflictException("Bu kıraathanede giriş görevli tarafından manuel yapılır.", "MANUAL_REQUIRED");
    }

    private async Task<Library> GetLibraryAsync(Guid libraryId, CancellationToken ct)
        => await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

    private const string LibraryVisitPointsActionKey = "library_visit";

    private async Task TryAwardLibraryPointsAsync(Domain.Entities.Libraries.LibrarySession session, Guid libraryId, CancellationToken ct)
    {
        if (session.PointsAwarded) return;
        if (session.ParticipantId is not Guid participantId) return;

        var s = await settings.GetAsync(libraryId, ct);
        if (!s.PointsEnabled || s.PointsPerVisit <= 0) return;
        if (s.QrRequired && session.EntryMethod != "qr") return;

        if (s.DailyPointCap > 0)
        {
            var todaySum = await uow.LoyaltyTransactions.GetPointsSumSinceAsync(participantId, LibraryVisitPointsActionKey, TurkeyTime.TodayStartUtc(), ct);
            if (todaySum >= s.DailyPointCap) return;
        }
        if (s.WeeklyPointCap > 0)
        {
            var weekStart = TurkeyTime.ToUtc(StartOfWeek(TurkeyTime.TodayDate()));
            var weekSum = await uow.LoyaltyTransactions.GetPointsSumSinceAsync(participantId, LibraryVisitPointsActionKey, weekStart, ct);
            if (weekSum >= s.WeeklyPointCap) return;
        }

        var balance = await uow.LoyaltyTransactions.GetBalanceAsync(participantId, ct);
        var tx = LoyaltyTransaction.Create(participantId, LibraryVisitPointsActionKey, "Kıraathane Ziyareti",
            s.PointsPerVisit, balance + s.PointsPerVisit, session.Id.ToString());
        await uow.LoyaltyTransactions.AddAsync(tx, ct);
        session.MarkPointsAwarded();
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);
    }

    private static DateTime StartOfWeek(DateTime d)
    {
        var diff = ((int)d.DayOfWeek + 6) % 7;
        return d.AddDays(-diff);
    }

    private async Task<(Guid? ParticipantId, string Name, string Tckn, string? Phone, DateTime? BirthDate, string? GuardianPhone)> ResolveMemberAsync(
        string? participantIdRaw, string? tckn, string? memberName, string? phone, string? birthDateRaw, string? guardianPhone, CancellationToken ct)
    {
        if (Guid.TryParse(participantIdRaw, out var pid) && pid != Guid.Empty)
        {
            var part = await uow.Participants.GetByIdAsync(pid, ct)
                ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
            return (part.Id, part.FullName, part.Tckn, part.Phone, part.BirthDate, part.GuardianPhone);
        }
        if (string.IsNullOrWhiteSpace(participantIdRaw) && !string.IsNullOrWhiteSpace(tckn))
        {
            var byTckn = await uow.Participants.GetByTcknAsync(tckn, ct);
            if (byTckn != null)
                return (byTckn.Id, byTckn.FullName, byTckn.Tckn, byTckn.Phone, byTckn.BirthDate, byTckn.GuardianPhone);
            throw new NotFoundException("Bu TC kimlik numarasıyla kayıtlı katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        }
        if (string.IsNullOrWhiteSpace(memberName) && string.IsNullOrWhiteSpace(tckn))
            throw new ConflictException("Üye bilgisi (TC veya ad) gereklidir.", "MEMBER_REQUIRED");
        var name = string.IsNullOrWhiteSpace(memberName) ? "Ziyaretçi" : memberName!.Trim();
        return (null, name, tckn ?? "", phone, DateTime.TryParse(birthDateRaw, out var bd) ? bd : null, guardianPhone);
    }

    private static string NormalizeMethod(string? method) => method == "qr" ? "qr" : "manual";

    private async Task LogAsync(AuditAction action, string entityType, Guid entityId, string description, CancellationToken ct)
        => await audit.LogAsync(new AuditEntry { Action = action, EntityType = entityType, EntityId = entityId, Module = "Library", Description = description }, ct);

    private static PagedResult<TOut> Map<TIn, TOut>(PagedResult<TIn> src, Func<TIn, TOut> map)
        => new() { Items = src.Items.Select(map).ToList(), Total = src.Total, Page = src.Page, Limit = src.Limit };

    private static OccupantDto MapOccupant(LibrarySession x, LibrarySettingsDto s, Func<string?, (string? Label, string? FloorId)> seatFloor)
    {
        var (label, floorId) = seatFloor(x.Seat);
        return new(
            x.Id.ToString(),
            (x.ParticipantId ?? x.Id).ToString(),
            x.MemberName,
            label,
            x.EntryTime,
            MinutesSince(x.EntryTime),
            Math.Max(0, s.MaxDailyBreaks - x.ShortBreaksUsed),
            Math.Max(0, 1 - x.LongBreaksUsed),
            LibrarySessionStatus.IsOnBreak(x.Status) ? "on_break" : "inside",
            x.Status == LibrarySessionStatus.OnBreakLong ? "long"
                : x.Status == LibrarySessionStatus.OnBreakShort ? "short" : null,
            floorId);
    }

    private static QueueEntryDto MapQueue(LibraryQueueEntry x)
        => new(x.Id.ToString(), x.QueueNumber, x.MemberName, x.Tckn, x.Phone, x.Method, x.Status, x.JoinedAt, x.CalledAt, x.CountdownExpiresAt);

    private static LibraryBreakDto MapBreak(LibraryBreak x, Func<string?, (string? Label, string? FloorId)> seatFloor)
    {
        var (label, floorId) = seatFloor(x.Seat);
        return new(x.Id.ToString(), (x.ParticipantId ?? x.SessionId).ToString(), x.MemberName, x.SessionId.ToString(), x.Type, x.StartTime, MinutesUntil(x.ExpectedReturnAt), x.SeatHeld, label, floorId);
    }

    private static ExitedSessionDto MapExited(LibrarySession x, Func<string?, (string? Label, string? FloorId)> seatFloor)
    {
        var (label, floorId) = seatFloor(x.Seat);
        return new(
            x.Id.ToString(),
            (x.ParticipantId ?? x.Id).ToString(),
            x.MemberName,
            x.EntryTime,
            x.ExitTime ?? x.EntryTime,
            (int)Math.Max(0, ((x.ExitTime ?? x.EntryTime) - x.EntryTime).TotalMinutes),
            x.ShortBreaksUsed,
            x.LongBreaksUsed,
            x.Status == LibrarySessionStatus.Completed ? "manual" : "auto",
            label,
            floorId);
    }

    public async Task<PagedResult<LibraryOverdueEntryDto>> GetOverdueBooksAsync(LibraryOverdueListParams p, CancellationToken ct)
    {
        List<LibraryOverdueEntryDto> all = [];

        if (current.IsSuperAdmin)
        {
            var libraries = await uow.Libraries.GetActiveAsync(ct);
            var targets = libraries
                .Where(lib => string.IsNullOrWhiteSpace(p.LibraryId) || lib.Id.ToString() == p.LibraryId)
                .ToList();
            foreach (var lib in targets)
            {
                var sessions = await uow.LibrarySessions.GetActiveByLibraryAsync(lib.Id, ct);
                var members = sessions
                    .Where(s => !string.IsNullOrWhiteSpace(s.Tckn))
                    .Select(s => (tckn: s.Tckn, memberName: s.MemberName))
                    .DistinctBy(m => m.tckn)
                    .ToList();
                all.AddRange(await emanet.GetAllOverdueForLibraryAsync(lib.Id.ToString(), lib.Name, members, ct));
            }
        }
        else if (!string.IsNullOrWhiteSpace(p.LibraryId) && Guid.TryParse(p.LibraryId, out var libGuid))
        {
            await EnsureInScopeAsync(libGuid, ct);
            var lib = await uow.Libraries.GetByIdAsync(libGuid, ct);
            if (lib is not null)
            {
                var sessions = await uow.LibrarySessions.GetActiveByLibraryAsync(lib.Id, ct);
                var members = sessions
                    .Where(s => !string.IsNullOrWhiteSpace(s.Tckn))
                    .Select(s => (tckn: s.Tckn, memberName: s.MemberName))
                    .DistinctBy(m => m.tckn)
                    .ToList();
                all = await emanet.GetAllOverdueForLibraryAsync(lib.Id.ToString(), lib.Name, members, ct);
            }
        }

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var search = p.Search.ToLowerInvariant();
            all = all.Where(e =>
                e.MemberName.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                e.BookTitle.Contains(search, StringComparison.OrdinalIgnoreCase)
            ).ToList();
        }

        var total = all.Count;
        var items = all
            .Skip((p.PageResolved - 1) * p.LimitResolved)
            .Take(p.LimitResolved)
            .ToList();

        return new PagedResult<LibraryOverdueEntryDto>
        {
            Items = items,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<LibraryStaticQrDto> GetStaticQrAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        return ToStaticQrDto(library);
    }

    public async Task<LibraryStaticQrDto> ToggleStaticQrAsync(Guid libraryId, bool enabled, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        if (enabled && library.SeatingMode == "masali" && library.StaticQrMode is "entry_exit" or "split")
            throw new ConflictException(
                "Masalı (koltuk seçmeli) sistemde sabit QR yalnızca \"Yoklama\" modunda kullanılabilir; \"entry_exit\"/\"split\" modları koltuk numarası gerektirdiğinden sabit QR ile giriş yapılamaz.",
                "SEATING_MODE_CONFLICT");
        if (enabled && library.EntryControlMode == "manual" && library.StaticQrMode is "entry_exit" or "split")
            throw new ConflictException(
                "Bu kıraathanenin giriş kontrolü \"Manuel\" olduğundan sabit QR bu modda giriş/çıkış kaydı oluşturamaz. Önce giriş kontrolünü \"QR\" yapın veya sabit QR modunu \"Yoklama\" olarak bırakın.",
                "ENTRY_CONTROL_MODE_CONFLICT");
        if (enabled && string.IsNullOrWhiteSpace(library.StaticQrCode))
            library.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        library.SetStaticQrEnabled(enabled);
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id,
            enabled ? $"Sabit QR etkinleştirildi: {library.Name}" : $"Sabit QR devre dışı bırakıldı: {library.Name}", ct);
        return ToStaticQrDto(library);
    }

    public async Task<LibraryStaticQrDto> SetStaticQrModeAsync(Guid libraryId, string mode, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        if (mode is "entry_exit" or "split" && library.EntryControlMode == "manual")
            throw new ConflictException(
                "Bu kıraathanenin giriş kontrolü \"Manuel\" olduğundan sabit QR bu modda giriş/çıkış kaydı oluşturamaz. Önce giriş kontrolünü \"QR\" yapın veya sabit QR modunu \"Yoklama\" olarak bırakın.",
                "ENTRY_CONTROL_MODE_CONFLICT");
        if (mode is "entry_exit" or "split" && library.SeatingMode == "masali")
            throw new ConflictException(
                "Masalı (koltuk seçmeli) sistemde sabit QR yalnızca \"Yoklama\" modunda kullanılabilir; bu modlar koltuk numarası gerektirdiğinden sabit QR ile giriş yapılamaz.",
                "SEATING_MODE_CONFLICT");
        var oldMode = library.StaticQrMode;
        library.SetStaticQrMode(mode);
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id,
            $"Sabit QR modu değiştirildi: {library.Name} ({oldMode} → {mode})", ct);
        return ToStaticQrDto(library);
    }

    public async Task<LibraryStaticQrDto> SetStaticQrTimingAsync(Guid libraryId, int minExitMinutes, int reentryCooldownMinutes, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        library.SetStaticQrTiming(minExitMinutes, reentryCooldownMinutes);
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id,
            $"Sabit QR zamanlaması değiştirildi: {library.Name} (minExit={minExitMinutes}dk, reentryCooldown={reentryCooldownMinutes}dk)", ct);
        return ToStaticQrDto(library);
    }

    public async Task<LibraryStaticQrDto> RotateStaticQrAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var library = await GetLibraryAsync(libraryId, ct);
        library.RotateStaticQrCode(await GenerateStaticQrCodeAsync(ct));
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        await LogAsync(AuditAction.Update, "Library", library.Id, $"Sabit QR kodu yenilendi: {library.Name}", ct);
        return ToStaticQrDto(library);
    }

    public async Task<LibraryScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, double? latitude, double? longitude, CancellationToken ct)
    {
        var session = await uow.LibrarySessions.GetActiveByParticipantAsync(participantId, ct);
        var (baseCode, direction) = ParseStaticQrCode((staticCode ?? "").Trim());
        var library = string.IsNullOrWhiteSpace(baseCode) ? null : await uow.Libraries.GetByStaticQrCodeAsync(baseCode, ct);
        if (library is null)
        {
            if (session is not null)
                throw await ActiveSessionConflictAsync(session, session.LibraryId, ct);
            throw new ConflictException("Bu QR kodu tanınmadı. Kıraathane kapısındaki güncel QR kodunu okutun.", "INVALID_QR");
        }
        if (!library.StaticQrEnabled)
            throw new ConflictException($"{library.Name} için QR ile giriş şu an kapalı. Görevliye başvurun.", "INVALID_QR");
        if (!library.IsActive)
            throw new ConflictException("Bu kıraathane şu anda kapalı.", "LIBRARY_INACTIVE");
        EnforceNotOpenType(library);

        if (library.TriggersDevice && session is not null)
            throw await ActiveSessionConflictAsync(session, library.Id, ct);
        if (library.TriggersDevice)
            throw new ConflictException("Bu kıraathanede giriş/çıkış turnike/kapıdan QR okutarak yapılır. QR kodunuzu okuyucuya gösterin.", "DEVICE_SCAN_REQUIRED");

        var location = await uow.ServiceFacilities.GetByIdAsync(library.ServiceFacilityId, ct);
        var islem = direction == StaticQrExitSuffix || (direction is null && session?.LibraryId == library.Id) ? "çıkış" : "giriş";
        try
        {
            Nexora.Application.Common.LocationAccessGuard.EnsureInside(
                library.GeofenceLatitude ?? location?.Latitude, library.GeofenceLongitude ?? location?.Longitude,
                library.GeofenceRadiusMeters, latitude, longitude);
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OUTSIDE_GEOFENCE")
        {
            throw new ConflictException($"Şu an {library.Name} konumunda değilsiniz, {islem} yapamazsınız. Kıraathanenin {library.GeofenceRadiusMeters} metre yakınına gelip tekrar deneyin.", "OUTSIDE_GEOFENCE");
        }
        catch (ConflictException ex) when (ex.ErrorCode == "LOCATION_REQUIRED")
        {
            throw new ConflictException($"Konumunuz alınamadı, {islem} yapılamadı. Telefonunuzun konum servisini açın ve uygulamaya konum izni verin.", "LOCATION_REQUIRED");
        }

        var mode = library.StaticQrMode;

        if (mode == "split" && direction is null)
            throw new ConflictException("Bu kıraathanede giriş ve çıkış için ayrı QR kodları kullanılır. Kapıdaki Giriş veya Çıkış QR'ını okutun.", "INVALID_QR");

        if (session is not null && session.LibraryId == library.Id && session.IsOnBreak)
        {
            var activeBreak = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
            if (activeBreak is not null)
                await EndBreakAsync(activeBreak.Id, ct);
            return new LibraryScanResultDto("end_break", "Moladan dönüldü.", session.Seat) with { ParticipantName = session.MemberName };
        }

        LibraryScanResultDto result;
        if (mode == "split" && direction == StaticQrExitSuffix)
        {
            if (session is null || session.LibraryId != library.Id)
                throw new ConflictException("Bu kıraathanede içeride aktif oturumunuz yok. Giriş için Giriş QR'ını okutun.", "NO_ACTIVE_SESSION");
            var secondsSinceEntrySplit = (DateTime.UtcNow - session.EntryTime).TotalSeconds;
            if (secondsSinceEntrySplit < library.StaticQrMinExitSeconds)
            {
                var remainSplit = Math.Max(1, (int)Math.Ceiling(library.StaticQrMinExitSeconds - secondsSinceEntrySplit));
                result = new LibraryScanResultDto("checkin",
                    $"Giriş az önce kaydedildi. Çıkış için en az {library.StaticQrMinExitSeconds} sn bekleyin (yaklaşık {remainSplit} sn kaldı).",
                    session.Seat);
            }
            else
            {
                await ExitAsync(session.Id, false, false, ct);
                result = new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
            }
        }
        else if (mode == "attendance")
        {
            if (session is not null && session.LibraryId == library.Id)
            {
                await ExitAsync(session.Id, false, false, ct);
                result = new LibraryScanResultDto("checkout", "Çıkış kaydedildi.", session.Seat);
            }
            else
            {
                var m = await ResolveMemberAsync(participantId.ToString(), null, null, null, null, null, ct);
                var attendanceSession = LibrarySession.Create(library.Id, m.ParticipantId, m.Name, m.Tckn, m.Phone, m.BirthDate, m.GuardianPhone, null, null, "qr");
                attendanceSession.Exit(false);
                await uow.LibrarySessions.AddAsync(attendanceSession, ct);
                await uow.SaveChangesAsync(ct);
                await LogAsync(AuditAction.CheckIn, "LibrarySession", attendanceSession.Id, $"Yoklama kaydı (sabit QR): {m.Name}", ct);
                result = new LibraryScanResultDto("attendance", "Yoklama kaydedildi.", null);
            }
        }
        else if (mode == "entry_exit")
        {
            if (session is not null && session.LibraryId == library.Id)
            {
                var minutesSinceEntry = (DateTime.UtcNow - session.EntryTime).TotalSeconds;
                if (minutesSinceEntry < library.StaticQrMinExitSeconds)
                {
                    var remain = Math.Max(1, (int)Math.Ceiling(library.StaticQrMinExitSeconds - minutesSinceEntry));
                    result = new LibraryScanResultDto("checkin",
                        $"Giriş zaten kaydedildi. Çıkış için en az {library.StaticQrMinExitSeconds} sn sonra tekrar okutun (yaklaşık {remain} sn kaldı).",
                        session.Seat);
                }
                else
                {
                    await ExitAsync(session.Id, false, false, ct);
                    result = new LibraryScanResultDto("checkout", "Çıkış yapıldı.", session.Seat);
                }
            }
            else
            {
                await EnsureReentryCooldownElapsedAsync(library, participantId, ct);
                var req = new LibraryCheckInRequest(null, participantId.ToString(), null, null, null, null, "qr", null);
                var checkIn = await CheckInAsync(library.Id, req, false, ct);
                result = new LibraryScanResultDto(checkIn.Entered ? "checkin" : "queued", checkIn.Message, checkIn.Seat);
            }
        }
        else
        {
            if (session is not null)
                throw await ActiveSessionConflictAsync(session, library.Id, ct);

            await EnsureReentryCooldownElapsedAsync(library, participantId, ct);
            var req = new LibraryCheckInRequest(null, participantId.ToString(), null, null, null, null, "qr", null);
            var checkIn = await CheckInAsync(library.Id, req, false, ct);
            result = new LibraryScanResultDto(checkIn.Entered ? "checkin" : "queued", checkIn.Message, checkIn.Seat);
        }

        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        return result with { ParticipantName = participant?.FullName ?? session?.MemberName };
    }

    private const string StaticQrEntrySuffix = "-giris";
    private const string StaticQrExitSuffix = "-cikis";

    private static readonly System.Text.RegularExpressions.Regex StaticQrCodePattern = new(
        @"nxr-lib_[0-9a-f]{32}(?:-giris|-cikis)?",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

    private static (string BaseCode, string? Direction) ParseStaticQrCode(string raw)
    {
        var match = StaticQrCodePattern.Match(Uri.UnescapeDataString(raw));
        var code = match.Success ? match.Value.ToLowerInvariant() : raw;
        foreach (var suffix in new[] { StaticQrEntrySuffix, StaticQrExitSuffix })
            if (code.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                return (code[..^suffix.Length], suffix);
        return (code, null);
    }

    private static LibraryStaticQrDto ToStaticQrDto(Library library)
    {
        var code = library.StaticQrEnabled ? library.StaticQrCode : null;
        var split = code is not null && library.StaticQrMode == "split";
        return new(library.StaticQrEnabled, library.StaticQrMode, code,
            split ? code + StaticQrEntrySuffix : null,
            split ? code + StaticQrExitSuffix : null,
            library.StaticQrMinExitSeconds,
            library.StaticQrReentryCooldownSeconds);
    }

    private async Task EnsureReentryCooldownElapsedAsync(Library library, Guid participantId, CancellationToken ct)
    {
        if (library.StaticQrReentryCooldownSeconds <= 0) return;

        var lastClosed = (await uow.LibrarySessions.FindAsync(
                s => s.LibraryId == library.Id && s.ParticipantId == participantId && s.ExitTime.HasValue, ct))
            .OrderByDescending(s => s.ExitTime!.Value)
            .FirstOrDefault();
        if (lastClosed is null) return;

        var secondsSinceExit = (DateTime.UtcNow - lastClosed.ExitTime!.Value).TotalSeconds;
        if (secondsSinceExit < library.StaticQrReentryCooldownSeconds)
        {
            var remain = Math.Max(1, (int)Math.Ceiling(library.StaticQrReentryCooldownSeconds - secondsSinceExit));
            throw new ConflictException($"Çok yakın zamanda çıkış yaptınız. Tekrar giriş için {remain} sn daha bekleyin.", "REENTRY_COOLDOWN_ACTIVE");
        }
    }

    private async Task<string> GenerateStaticQrCodeAsync(CancellationToken ct)
    {
        string code;
        do { code = "nxr-lib_" + Guid.NewGuid().ToString("N"); }
        while (await uow.Libraries.ExistsByStaticQrCodeAsync(code, ct));
        return code;
    }
}
