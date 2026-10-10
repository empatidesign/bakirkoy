using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface ILibraryMaintenanceJob
{
    Task RunAsync(CancellationToken ct);
}

public class LibraryMaintenanceJob(
    IUnitOfWork uow,
    ILibrarySettingsService settings,
    ILibraryNotificationService notify,
    ILibraryOperationsService libraryOps,
    Nexora.Application.Common.Interfaces.IAuditService audit,
    Microsoft.Extensions.Configuration.IConfiguration config) : ILibraryMaintenanceJob
{
    private int EntryWarnMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryNotifications:EntryWarnMinutes", 5);
    private int ExitWarnMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryNotifications:ExitWarnMinutes", 5);
    private int BreakEndWarnMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryNotifications:BreakEndWarnMinutes", 5);
    // #25 fix: "LibrarySettings:" section'ı hiçbir appsettings.json'da tanımlı değil (repo
    // genelinde, ör. LibraryOperationsService.cs, FacilityAttendanceService.cs, aynı ayar için
    // "FacilitySettings:" kullanıyor) — bu yüzden gün-sonu kapatma saati Consul KV üzerinden
    // operasyonel olarak asla değiştirilemiyordu, hep kod içi varsayılana (23:00) sabit kalıyordu.
    private int LocalTimeZoneOffsetMinutes => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
    private int DailyCutoffHour => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "FacilitySettings:DailyCutoffHour", 23);
    private int DailyCutoffMinute => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "FacilitySettings:DailyCutoffMinute", 0);

    /// <summary>
    /// Mesainin ait olduğu gün sonu kesimi (UTC). Yerel saatte kesimden önce başlayan mesai o günün
    /// kesiminde, kesimden sonra başlayan (gece) mesai ertesi günün kesiminde kapanır.
    /// </summary>
    private DateTime CutoffUtcFor(DateTime startUtc)
        => Nexora.Domain.Common.ShiftCutoff.CutoffUtcFor(startUtc, LocalTimeZoneOffsetMinutes, DailyCutoffHour, DailyCutoffMinute);

    public async Task RunAsync(CancellationToken ct)
    {
        var entryWarn = EntryWarnMinutes;
        var exitWarn = ExitWarnMinutes;
        var breakEndWarn = BreakEndWarnMinutes;
        var now = DateTime.UtcNow;
        var cache = new Dictionary<Guid, LibrarySettingsDto>();
        var exitNotices = new List<(Guid LibraryId, string Name, DateTime? BirthDate, string? GuardianPhone)>();
        var breakNudges = new List<(Guid LibraryId, Guid? ParticipantId, string Phone, string Name)>();
        var studyWarnings = new List<(Guid LibraryId, Guid? ParticipantId, string Phone, string Name)>();
        // Mobil QA bulgusu (2026-09-22, madde 70): "süre bitince uyarı vermeden atıyor".
        // Kök neden: aşağıda yalnızca MaxStudyHoursPerDay (çalışma süresi) için önceden
        // uyarı gönderiliyordu; AutoCheckOutAfterMinutes (inaktivite) ile kapanan
        // oturumlar için hiçbir uyarı yolu yoktu — oturum sessizce sonlandırılıyordu.
        var inactivityWarnings = new List<(Guid LibraryId, Guid? ParticipantId, string Phone, string Name)>();
        var holdWarnings = new List<(Guid LibraryId, Guid? ParticipantId, string Phone, string Name)>();
        var breakWarnings = new List<(Guid LibraryId, Guid? ParticipantId, string Phone, string Name)>();
        // KOD DENETİMİ (#11, 2026-08-26): promoteLibraries artık en üstte tanımlanıyor ki
        // gün-sonu toplu kapatma / mola aşımı (grace expiry) / inaktivite-çalışma süresi
        // aşımı ile otomatik kapanan her oturum, koltuğu boşalttığı kütüphaneyi de bu
        // sete ekleyebilsin. Önceden set aşağıda (kuyruk expire bloğunda) tanımlıydı ve
        // bu üç otomatik kapanma noktası kuyruktaki bekleyene hiç terfi tetiklemiyordu.
        var promoteLibraries = new HashSet<Guid>();

        var localNow = now.AddMinutes(LocalTimeZoneOffsetMinutes);
        if (localNow.Hour == DailyCutoffHour && localNow.Minute == DailyCutoffMinute)
        {
            var toClose = await uow.LibrarySessions.GetActiveSessionsAsync(ct);
            foreach (var session in toClose)
            {
                var openBreak = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
                if (openBreak is not null) { openBreak.Expire(); uow.LibraryBreaks.Update(openBreak); }
                session.CloseByStaff();
                uow.LibrarySessions.Update(session);
                exitNotices.Add((session.LibraryId, session.MemberName, session.BirthDate, session.GuardianPhone));
                promoteLibraries.Add(session.LibraryId); // #11: gün-sonu otomatik kapatma da kuyruğu terfi ettirmeli
            }
            if (toClose.Count > 0) await uow.SaveChangesAsync(ct);

            var openShifts = await uow.LibraryShifts.GetAllOpenAsync(ct);
            if (openShifts.Count > 0)
            {
                var cutoffUtc = now;
                var closedSummaries = new List<(Guid Id, string StaffName, int WorkedMinutes)>();
                foreach (var shift in openShifts)
                {
                    shift.AutoCloseAtCutoff(cutoffUtc);
                    uow.LibraryShifts.Update(shift);
                    closedSummaries.Add((shift.Id, shift.StaffName, shift.WorkedMinutes ?? 0));
                }
                await uow.SaveChangesAsync(ct);
                foreach (var (id, staffName, workedMinutes) in closedSummaries)
                {
                    try
                    {
                        await audit.LogAsync(new Nexora.Application.Common.Interfaces.AuditEntry
                        {
                            Action = Nexora.Domain.Enums.AuditAction.CheckOut,
                            EntityType = "LibraryShift",
                            EntityId = id,
                            Module = "Library",
                            Description = $"Mesai gün sonu kesiminde ({DailyCutoffHour:00}:{DailyCutoffMinute:00}) otomatik sonlandırıldı: {staffName} ({workedMinutes} dk)",
                        }, ct);
                    }
                    catch { }
                }
            }
        }

        // Kaçırılmış gün sonu (2026-09-25): kesim yalnız tam 23:00 dakikasında çalışıyordu;
        // sunucu o dakikada kapalı/yeniden başlıyorsa açık mesai ertesi güne taşınıp 24+ saatlik
        // sahte kayıt oluşuyordu. Başladığı günün kesim saati geçmiş her açık mesai, o günün
        // kesim anında (şimdi değil) kapatılır — süre gerçekçi kalır.
        {
            var stale = (await uow.LibraryShifts.GetAllOpenAsync(ct))
                .Where(s => CutoffUtcFor(s.StartTime) <= now)
                .ToList();
            foreach (var shift in stale)
            {
                var cutoffUtc = CutoffUtcFor(shift.StartTime);
                shift.AutoCloseAtCutoff(cutoffUtc < shift.StartTime ? shift.StartTime : cutoffUtc);
                uow.LibraryShifts.Update(shift);
            }
            if (stale.Count > 0)
            {
                await uow.SaveChangesAsync(ct);
                foreach (var shift in stale)
                {
                    try
                    {
                        await audit.LogAsync(new Nexora.Application.Common.Interfaces.AuditEntry
                        {
                            Action = Nexora.Domain.Enums.AuditAction.CheckOut,
                            EntityType = "LibraryShift",
                            EntityId = shift.Id,
                            Module = "Library",
                            Description = $"Mesai kaçırılmış gün sonu kesimiyle ({DailyCutoffHour:00}:{DailyCutoffMinute:00}, başladığı gün) otomatik sonlandırıldı: {shift.StaffName} ({shift.WorkedMinutes} dk)",
                        }, ct);
                    }
                    catch { }
                }
            }
        }

        var expiredBreaks = await uow.LibraryBreaks.GetExpiredGraceAsync(now, ct);
        foreach (var brk in expiredBreaks)
        {
            brk.Expire();
            uow.LibraryBreaks.Update(brk);
            var session = await uow.LibrarySessions.GetByIdAsync(brk.SessionId, ct);
            if (session is not null && LibrarySessionStatus.IsOnBreak(session.Status))
            {
                session.Exit(true);
                uow.LibrarySessions.Update(session);
                exitNotices.Add((session.LibraryId, session.MemberName, session.BirthDate, session.GuardianPhone));
                promoteLibraries.Add(session.LibraryId); // #11: mola aşımı (grace expiry) ile kapanan oturum kuyruğu terfi ettirmeli
            }
        }

        var active = await uow.LibrarySessions.GetActiveSessionsAsync(ct);
        foreach (var session in active)
        {
            if (!LibrarySessionStatus.IsActive(session.Status)) continue;
            var s = await GetSettingsAsync(session.LibraryId, cache, ct);
            var minutes = (now - session.EntryTime).TotalMinutes;

            var overInactivity = s.AutoCheckOutAfterMinutes > 0 && minutes >= s.AutoCheckOutAfterMinutes;
            var overStudy = s.MaxStudyHoursPerDay > 0 && minutes >= s.MaxStudyHoursPerDay * 60;
            if (overInactivity || overStudy)
            {
                var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct);
                if (brk is not null) { brk.Expire(); uow.LibraryBreaks.Update(brk); }
                session.Exit(true);
                uow.LibrarySessions.Update(session);
                exitNotices.Add((session.LibraryId, session.MemberName, session.BirthDate, session.GuardianPhone));
                promoteLibraries.Add(session.LibraryId); // #11: inaktivite/çalışma süresi aşımı ile kapanan oturum kuyruğu terfi ettirmeli
                continue;
            }

            if (s.RequireBreakAfterHours > 0 && !string.IsNullOrWhiteSpace(session.Phone))
            {
                var threshold = s.RequireBreakAfterHours * 60.0;
                if (minutes >= threshold && minutes < threshold + 1)
                    breakNudges.Add((session.LibraryId, session.ParticipantId, session.Phone!, session.MemberName));
            }

            if (s.MaxStudyHoursPerDay > 0 && !string.IsNullOrWhiteSpace(session.Phone))
            {
                var remaining = s.MaxStudyHoursPerDay * 60.0 - minutes;
                if (remaining <= exitWarn && remaining > exitWarn - 1)
                    studyWarnings.Add((session.LibraryId, session.ParticipantId, session.Phone!, session.MemberName));
            }

            // Madde 70: inaktivite kaynaklı otomatik çıkış için de önceden uyarı. Yukarıdaki
            // çalışma-süresi uyarısıyla birebir aynı desen ve aynı eşik (exitWarn); bu dal
            // olmadan AutoCheckOutAfterMinutes dolduğunda oturum hiç haber verilmeden
            // kapanıyordu (yukarıdaki overInactivity bloğu doğrudan Exit çağırıyor).
            if (s.AutoCheckOutAfterMinutes > 0 && !string.IsNullOrWhiteSpace(session.Phone))
            {
                var remaining = s.AutoCheckOutAfterMinutes - minutes;
                if (remaining <= exitWarn && remaining > exitWarn - 1)
                    inactivityWarnings.Add((session.LibraryId, session.ParticipantId, session.Phone!, session.MemberName));
            }
        }

        foreach (var brk in await uow.LibraryBreaks.GetActiveBreaksAsync(ct))
        {
            var session = await uow.LibrarySessions.GetByIdAsync(brk.SessionId, ct);
            if (session is null || string.IsNullOrWhiteSpace(session.Phone)) continue;
            var remaining = (brk.ExpectedReturnAt - now).TotalMinutes;
            if (remaining <= breakEndWarn && remaining > breakEndWarn - 1)
                breakWarnings.Add((session.LibraryId, session.ParticipantId, session.Phone!, session.MemberName));
        }

        foreach (var q in await uow.LibraryQueue.GetExpiredCalledAsync(now, ct))
        {
            q.Expire();
            uow.LibraryQueue.Update(q);
            promoteLibraries.Add(q.LibraryId);
        }

        var expiredHolds = new List<(Guid? ParticipantId, string? Phone, string Name, Guid LibraryId)>();
        foreach (var r in await uow.LibraryReservations.GetExpiredHoldsAsync(now, ct))
        {
            r.Expire();
            uow.LibraryReservations.Update(r);
            expiredHolds.Add((r.ParticipantId, r.Phone, r.MemberName, r.LibraryId));
        }

        foreach (var r in await uow.LibraryReservations.GetActiveHoldsAsync(ct))
        {
            if (string.IsNullOrWhiteSpace(r.Phone)) continue;
            var remaining = (r.HoldUntil - now).TotalMinutes;
            if (remaining <= entryWarn && remaining > entryWarn - 1)
                holdWarnings.Add((r.LibraryId, r.ParticipantId, r.Phone, r.MemberName));
        }

        var exitIntentWindowMinutes = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ExitIntentWindowMinutes", 5);
        var expiredExitIntents = await uow.LibrarySessions.GetExpiredExitIntentsAsync(now.AddMinutes(-exitIntentWindowMinutes), ct);
        foreach (var exitSession in expiredExitIntents)
        {
            var exitBrk = await uow.LibraryBreaks.GetActiveBySessionAsync(exitSession.Id, ct);
            if (exitBrk is not null) { exitBrk.End(); uow.LibraryBreaks.Update(exitBrk); }
            var hadSeat = !string.IsNullOrWhiteSpace(exitSession.Seat);
            // KOD DENETİMİ (2026-08-14): Önceden burada yalnızca ReleaseSeatOnExitTimeout()
            // çağrılıyordu — bu yalnızca koltuğu boşaltır, Status'u "exit_pending"den ÇIKARMAZ.
            // exit_pending, ActiveStatuses listesinde olduğu için oturum kapasitede süresiz
            // "içeride" sayılmaya devam ediyordu (AutoCheckOutAfterMinutes=0 olan — canlı DB'de
            // 1406 kütüphaneden 926'sı — kütüphanelerde bu asla kendiliğinden düzelmiyordu).
            // ExitAsNoShow() zaten doğru şekilde tasarlanmıştı (Status→no_show, ExitTime set,
            // IsExitNoShow=true) ama hiç çağrılmıyordu. Kişi çıkış niyeti bildirip süresi içinde
            // QR okutmadıysa artık gerçek bir no-show olarak kapatılıyor: kapasite serbest kalır,
            // raporlarda doğru görünür, veliye çıkış bildirimi gider (aşağıdaki exitNotices).
            exitSession.ExitAsNoShow();
            uow.LibrarySessions.Update(exitSession);
            if (hadSeat) promoteLibraries.Add(exitSession.LibraryId);
            exitNotices.Add((exitSession.LibraryId, exitSession.MemberName, exitSession.BirthDate, exitSession.GuardianPhone));
        }

        await uow.SaveChangesAsync(ct);

        foreach (var lib in promoteLibraries)
        {
            try { await libraryOps.TryPromoteQueueAsync(lib, ct); }
            catch { }
        }

        var libraryNameCache = new Dictionary<Guid, string>();
        async Task<string> LibNameAsync(Guid libId)
        {
            if (libraryNameCache.TryGetValue(libId, out var cached)) return cached;
            var name = (await uow.Libraries.GetByIdAsync(libId, ct))?.Name ?? "Kıraathane";
            libraryNameCache[libId] = name;
            return name;
        }

        foreach (var n in exitNotices)
        {
            try { await notify.NotifyGuardianOnExitAsync(n.LibraryId, await LibNameAsync(n.LibraryId), n.Name, n.BirthDate, n.GuardianPhone, ct); }
            catch { }
        }
        foreach (var nudge in breakNudges)
        {
            try { await notify.NotifyMemberWarnAsync(nudge.LibraryId, await LibNameAsync(nudge.LibraryId), "break_nudge", nudge.ParticipantId, nudge.Phone, nudge.Name, "Uzun süredir aralıksız çalışıyorsunuz; lütfen bir mola verin.", ct); }
            catch { }
        }
        foreach (var w in studyWarnings)
        {
            try { await notify.NotifyMemberWarnAsync(w.LibraryId, await LibNameAsync(w.LibraryId), "study_time_warning", w.ParticipantId, w.Phone, w.Name, "Çıkış süreniz dolmak üzere; son 5 dakikadasınız.", ct); }
            catch { }
        }
        foreach (var w in inactivityWarnings)
        {
            try { await notify.NotifyMemberWarnAsync(w.LibraryId, await LibNameAsync(w.LibraryId), "inactivity_warning", w.ParticipantId, w.Phone, w.Name, "Oturumunuz birazdan otomatik olarak sonlandırılacak; devam edecekseniz uygulamadan işlem yapın.", ct); }
            catch { }
        }
        foreach (var w in breakWarnings)
        {
            try { await notify.NotifyMemberWarnAsync(w.LibraryId, await LibNameAsync(w.LibraryId), "break_warning", w.ParticipantId, w.Phone, w.Name, "Molanız bitmek üzere; son 5 dakika içinde yerinize dönün.", ct); }
            catch { }
        }
        foreach (var w in holdWarnings)
        {
            try { await notify.NotifyMemberWarnAsync(w.LibraryId, await LibNameAsync(w.LibraryId), "reservation_warning", w.ParticipantId, w.Phone, w.Name, "Rezervasyon giriş süreniz dolmak üzere; son 5 dakika içinde giriş yapın.", ct); }
            catch { }
        }

        foreach (var e in expiredHolds)
        {
            try { await notify.NotifyReservationExpiredAsync(e.LibraryId, e.ParticipantId, e.Phone, e.Name, await LibNameAsync(e.LibraryId), ct); }
            catch { }
        }
    }

    private async Task<LibrarySettingsDto> GetSettingsAsync(Guid libraryId, Dictionary<Guid, LibrarySettingsDto> cache, CancellationToken ct)
    {
        if (!cache.TryGetValue(libraryId, out var s))
        {
            s = await settings.GetAsync(libraryId, ct);
            cache[libraryId] = s;
        }
        return s;
    }
}
