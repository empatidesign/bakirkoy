using System.Text;
using System.Text.Json;
using Hangfire;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public class RecurringJobsBootstrapper(IRecurringJobManager manager, IConfiguration config, ILogger<RecurringJobsBootstrapper> logger) : IHostedService
{
    public Task StartAsync(CancellationToken ct)
    {
        try
        {
            manager.AddOrUpdate<IAuditLogRetentionJob>(
                "audit-log-retention",
                j => j.RunAsync(CancellationToken.None),
                "0 3 * * *");

            manager.AddOrUpdate<ILibraryMaintenanceJob>(
                "library-maintenance",
                j => j.RunAsync(CancellationToken.None),
                "* * * * *");

            manager.AddOrUpdate<IFacilityPeriodExpiryJob>(
                "facility-period-expiry",
                j => j.RunAsync(CancellationToken.None),
                "10 0 * * *");

            manager.AddOrUpdate<ITravelExpiryJob>(
                "travel-expiry",
                j => j.RunAsync(CancellationToken.None),
                "15 0 * * *");

            manager.AddOrUpdate<IEventExpiryJob>(
                "event-expiry",
                j => j.RunAsync(CancellationToken.None),
                "20 0 * * *");

            // Kullanici istegi (2026-09-07): online kullanici sayisi 5 dakikada bir
            // kalici olarak kaydedilsin (dashboard trend grafigi icin).
            manager.AddOrUpdate<IOnlineUserSnapshotJob>(
                "online-user-snapshot",
                j => j.RunAsync(CancellationToken.None),
                "*/5 * * * *");

            manager.AddOrUpdate<IFacilityAttendanceDeadlineJob>(
                "facility-attendance-deadline",
                j => j.RunAsync(CancellationToken.None),
                "* * * * *");

            manager.AddOrUpdate<IFacilityAutoCheckoutJob>(
                "facility-auto-checkout",
                j => j.RunAsync(CancellationToken.None),
                "* * * * *");

            manager.RemoveIfExists("travel-attendance-reminder");
            // Bulgu (2026-08-26, Hangfire denetimi): IAmbulanceAppointmentReminderJob sınıfı koddan
            // kaldırılmış ama Hangfire PostgreSQL storage'ındaki eski kayıt hiç temizlenmemişti —
            // */5 * * * * cron'u ile sürekli JobLoadException/TypeLoadException üretip duruyordu.
            manager.RemoveIfExists("ambulance-appointment-reminder");

            manager.AddOrUpdate<IDailyPlanReminderJob>(
                "daily-plan-reminder",
                j => j.RunAsync(CancellationToken.None),
                "0 5 * * *");

            manager.AddOrUpdate<ISurveyActivationJob>(
                "survey-activation",
                j => j.RunAsync(CancellationToken.None),
                "* * * * *");

            manager.AddOrUpdate<IParticipationSurveyGenerationJob>(
                "participation-survey-generation",
                j => j.RunAsync(CancellationToken.None),
                "*/15 * * * *");

            manager.AddOrUpdate<IDutyPharmacySyncJob>(
                "duty-pharmacy-sync",
                j => j.RunAsync(CancellationToken.None),
                config.GetValue("PharmacySettings:SyncCron", "0 */3 * * *"));

            manager.AddOrUpdate<IAfadGisSyncJob>(
                "afad-gis-emergency-area-sync",
                j => j.RunAsync(CancellationToken.None),
                config.GetValue("AfadGis:SyncCron", "30 4 * * *"));

            manager.AddOrUpdate<IParticipantActivitySyncJob>(
                "participant-activity-sync",
                j => j.RunAsync(CancellationToken.None),
                "*/5 * * * *");

            manager.AddOrUpdate<ITravelDepartureReminderJob>(
                "travel-departure-reminder",
                j => j.RunAsync(CancellationToken.None),
                "*/15 * * * *");

            manager.AddOrUpdate<IFacilitySessionReminderJob>(
                "facility-session-reminder",
                j => j.RunAsync(CancellationToken.None),
                "*/5 * * * *");

            manager.AddOrUpdate<IEventAttendanceReminderJob>(
                "event-attendance-reminder",
                j => j.RunAsync(CancellationToken.None),
                "*/5 * * * *");

            // Kullanıcı isteği (2026-09-07): doğum günü kutlama mesajı. Saat başı tetiklenir;
            // gerçek gönderim saatine (varsayılan 10:00) ve açık/kapalı ayarına servis karar verir,
            // böylece admin panelden saati değiştirince cron'u yeniden kaydetmek gerekmez.
            manager.AddOrUpdate<IBirthdayGreetingJob>(
                "birthday-greeting",
                j => j.RunAsync(CancellationToken.None),
                config.GetValue("BirthdaySettings:Cron", "0 * * * *"));

            manager.AddOrUpdate<ICitizenSubmissionStatusCheckJob>(
                "citizen-submission-status-check",
                j => j.RunAsync(CancellationToken.None),
                config.GetValue("CitizenSubmissionSettings:StatusCheckCron", "*/15 * * * *"));

            logger.LogInformation("Hangfire recurring jobs registered");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not register recurring jobs");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

public interface IAuditLogRetentionJob
{
    Task RunAsync(CancellationToken ct);
}

public interface IFacilityAttendanceDeadlineJob
{
    Task RunAsync(CancellationToken ct);
}

public interface IFacilityAutoCheckoutJob
{
    Task RunAsync(CancellationToken ct);
}

public class FacilityAutoCheckoutJob(IUnitOfWork uow) : IFacilityAutoCheckoutJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var nowUtc = DateTime.UtcNow;
        foreach (var module in FacilityModuleRegistry.All)
        {
            var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
            var minutes = FacilitySettingsValues.Int(settings?.SettingsJson, "autoCheckoutMinutes") ?? 0;
            if (minutes <= 0) continue;

            var threshold = nowUtc.AddMinutes(-minutes);
            var open = await uow.FacilityAttendances.FindAsync(
                a => a.Module == module && a.CheckedInAt != null && a.CheckedOutAt == null && a.CheckedInAt < threshold, ct);
            if (open.Count == 0) continue;

            foreach (var a in open)
            {
                a.MarkExit();
                uow.FacilityAttendances.Update(a);
            }
            await uow.SaveChangesAsync(ct);
        }
    }
}

public class FacilityAttendanceDeadlineJob(IUnitOfWork uow, IConfiguration config, IFacilityNotificationService notification, IFacilityAttendanceService attendance) : IFacilityAttendanceDeadlineJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var grace = config.GetValue("FacilitySettings:AttendanceGraceMinutes", 30);
        var reminder = config.GetValue("FacilitySettings:AttendanceReminderMinutes", 25);
        var offset = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        var baseUrl = config.GetValue("FacilitySettings:AdminBaseUrl", "");
        var now = DateTime.UtcNow.AddMinutes(offset);
        var today = now.Date;

        var sessions = await uow.FacilitySessions.FindAsync(
            s => !s.IsCancelled && s.AttendanceTakenAt == null && s.Date <= today, ct);
        if (sessions.Count == 0) return;

        var changed = false;
        var absenceNotices = new List<(FacilitySession Session, string GroupName, List<FacilityRegistration> Absent)>();
        foreach (var session in sessions)
        {
            var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
            // Kullanıcı isteği: "Devamsızlık Takibi" kapalı olan gruplarda (AttendanceMode "off" VEYA
            // "tracking_only" — ikisi de admin UI'da devamsızlığın kapalı olduğu anlamına gelir,
            // bkz. GroupFormFields.tsx "Sadece Yoklama: Devamsızlık yok") otomatik "gelmedi" kaydı
            // OLUŞTURULMAMALI. Önceden yalnızca "off" hariç tutuluyordu, bu yüzden tracking_only
            // gruplarda da her seans sonunda otomatik devamsızlık kaydı açılıyordu.
            if (group is null || group.AttendanceMode is "off" or "tracking_only") continue;
            if (!TryParseTime(session.EndTime, out var h, out var m)) continue;

            var end = session.Date.Date.AddHours(h).AddMinutes(m);

            if (now >= end.AddMinutes(grace))
            {
                var roster = (await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct))
                    .Where(r => r.Status == "active" && r.Kind == "main"
                        && FacilitySessionEligibility.IsEligible(session.Date, r.MembershipStart, r.PeriodEnd, session.IsCancelled))
                    .ToList();
                var alreadyMarked = (await uow.FacilityAttendances.GetBySessionAsync(session.Id, ct))
                    .Where(a => a.RegistrationId.HasValue).Select(a => a.RegistrationId!.Value).ToHashSet();

                var newlyAbsent = new List<FacilityRegistration>();
                foreach (var r in roster)
                {
                    if (alreadyMarked.Contains(r.Id)) continue;
                    var attendance = FacilityAttendance.Create(session.Module, session.FacilityId, group.Id, session.Id,
                        r.Id, r.ParticipantId, r.FullName, r.Tckn, "absent", "auto", "system/auto-attendance");
                    await uow.FacilityAttendances.AddAsync(attendance, ct);
                    newlyAbsent.Add(r);
                }
                session.MarkAttendanceTaken();
                uow.FacilitySessions.Update(session);
                changed = true;
                if (newlyAbsent.Count > 0) absenceNotices.Add((session, group.Name, newlyAbsent));
            }
            else if (session.AttendanceReminderSentAt is null && now >= end.AddMinutes(reminder))
            {
                var instructor = group.InstructorId.HasValue
                    ? await uow.FacilityInstructors.GetByIdAsync(group.InstructorId.Value, ct)
                    : null;
                var remaining = Math.Max(grace - reminder, 1);
                var link = string.IsNullOrWhiteSpace(baseUrl)
                    ? ""
                    : $"{baseUrl.TrimEnd('/')}/{session.Module}?facilityId={session.FacilityId}&date={session.Date:yyyy-MM-dd}";
                await notification.NotifyInstructorAttendanceReminderAsync(
                    instructor?.Phone, instructor?.FullName ?? group.InstructorName ?? "Eğitmen",
                    session.Date, session.StartTime, group.Name, link, remaining, ct);
                session.MarkReminderSent();
                uow.FacilitySessions.Update(session);
                changed = true;
            }
        }

        if (changed) await uow.SaveChangesAsync(ct);

        foreach (var (session, _, _) in absenceNotices)
            await attendance.EnforceAbsencesForSessionAsync(session.Module, session.Id, ct);

        foreach (var (session, groupName, absent) in absenceNotices)
            await notification.NotifyAttendanceAsync(session, groupName, absent.Select(r => (r, "absent")).ToList(), ct);
    }

    private static bool TryParseTime(string? t, out int hour, out int minute)
    {
        hour = 0; minute = 0;
        if (string.IsNullOrEmpty(t) || !t.Contains(':')) return false;
        var parts = t.Split(':');
        return parts.Length >= 2 && int.TryParse(parts[0], out hour) && int.TryParse(parts[1], out minute);
    }
}

public interface IDailyPlanReminderJob
{
    Task RunAsync(CancellationToken ct);
}

public class DailyPlanReminderJob(IUnitOfWork uow, IConfiguration config) : IDailyPlanReminderJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        if (!ScheduledNotificationSwitch.SendsEnabled(config)) return;

        var offset = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        var today = DateTime.UtcNow.AddMinutes(offset).Date;

        var plans = new Dictionary<Guid, List<string>>();

        var sessions = await uow.Sessions.FindAsync(s => s.Date.Date == today && s.IsActive, ct);
        if (sessions.Count > 0)
        {
            var sessionIds = sessions.Select(s => s.Id).ToHashSet();
            var eventIds = sessions.Select(s => s.EventId).Distinct().ToList();
            var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct))
                .ToDictionary(e => e.Id, e => e.Name);
            var sessionEventMap = sessions.ToDictionary(s => s.Id, s => (EventId: s.EventId, Time: s.StartTime));
            var eventApps = await uow.EventApplications.FindAsync(
                a => a.SessionId.HasValue && sessionIds.Contains(a.SessionId.Value) && a.Status == "approved", ct);
            foreach (var app in eventApps)
            {
                if (!app.SessionId.HasValue) continue;
                if (!sessionEventMap.TryGetValue(app.SessionId.Value, out var info)) continue;
                var label = events.TryGetValue(info.EventId, out var evName) ? evName : "Etkinlik";
                if (!string.IsNullOrWhiteSpace(info.Time)) label += $" ({info.Time})";
                Add(plans, app.ParticipantId, label);
            }
        }

        var travels = await uow.Travels.FindAsync(
            t => t.IsActive && t.StartDate.Date <= today && t.EndDate.Date >= today, ct);
        if (travels.Count > 0)
        {
            var travelIds = travels.Select(t => t.Id).ToHashSet();
            var travelMap = travels.ToDictionary(t => t.Id, t => t.Name);
            var travelApps = await uow.TravelApplications.FindAsync(
                a => travelIds.Contains(a.TravelId) && a.Status == "approved", ct);
            foreach (var app in travelApps)
            {
                var label = travelMap.TryGetValue(app.TravelId, out var tName) ? tName : "Gezi";
                Add(plans, app.ParticipantId, label);
            }
        }

        var facSessions = await uow.FacilitySessions.FindAsync(s => s.Date.Date == today && !s.IsCancelled, ct);
        if (facSessions.Count > 0)
        {
            var groupIds = facSessions.Select(s => s.GroupId).Distinct().ToHashSet();
            var groups = (await uow.FacilityGroups.FindAsync(g => groupIds.Contains(g.Id), ct))
                .ToDictionary(g => g.Id, g => $"{g.Name} ({GetModuleLabel(g.Module)})");
            var facRegs = await uow.FacilityRegistrations.FindAsync(
                r => groupIds.Contains(r.GroupId) && r.Status == "active" && r.Kind == "main", ct);
            foreach (var reg in facRegs)
            {
                if (!reg.ParticipantId.HasValue) continue;
                var label = groups.TryGetValue(reg.GroupId, out var gName) ? gName : "Program";
                Add(plans, reg.ParticipantId.Value, label);
            }
        }

        if (plans.Count == 0) return;

        var notifications = plans
            .Select(kvp => Notification.Create(
                kvp.Key,
                "Bugünkü Programlarınız",
                BuildBody(kvp.Value),
                "daily-plan"))
            .ToList();

        await uow.Notifications.AddRangeAsync(notifications, ct);
        await uow.SaveChangesAsync(ct);
    }

    private static void Add(Dictionary<Guid, List<string>> plans, Guid participantId, string label)
    {
        if (!plans.TryGetValue(participantId, out var list))
        {
            list = [];
            plans[participantId] = list;
        }
        list.Add(label);
    }

    private static string BuildBody(List<string> items)
    {
        var sb = new StringBuilder("Bugün şu programlarınız var:");
        foreach (var item in items)
            sb.Append($"\n• {item}");
        return sb.ToString();
    }

    private static string GetModuleLabel(string module) => module switch
    {
        "sports" => "Spor",
        "pool" => "Yüzme",
        "camp" => "Kamp",
        "accessible-life" => "Engelsiz Yaşam",
        "women-family" => "Kadın ve Aile",
        _ => "Program",
    };
}

public interface ISurveyActivationJob
{
    Task RunAsync(CancellationToken ct);
}

public class SurveyActivationJob(IUnitOfWork uow, IConfiguration config, IParticipantNotificationService participantNotify) : ISurveyActivationJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var offset = config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180);
        var now = DateTime.UtcNow.AddMinutes(offset);

        var surveys = await uow.Surveys.FindAsync(
            s => s.AutoSendAfterEvent && !s.IsActive && s.SourceType != null && s.SourceId != null,
            ct);

        if (surveys.Count == 0) return;

        var changed = false;
        foreach (var survey in surveys)
        {
            var ended = survey.SourceType == "Event"
                ? await IsEventEndedAsync(survey.SourceId!.Value, now, ct)
                : survey.SourceType == "Travel" && await IsTravelEndedAsync(survey.SourceId!.Value, now, ct);

            if (!ended) continue;

            survey.Activate();
            survey.SetStatus("active");
            uow.Surveys.Update(survey);
            changed = true;

            if (ScheduledNotificationSwitch.SendsEnabled(config))
                await NotifyParticipantsAsync(survey, ct);
        }

        if (changed) await uow.SaveChangesAsync(ct);
    }

    private async Task<bool> IsEventEndedAsync(Guid eventId, DateTime now, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null) return false;
        var effectiveEnd = ev.EndDate;
        return effectiveEnd.Date < now.Date;
    }

    private async Task<bool> IsTravelEndedAsync(Guid travelId, DateTime now, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null) return false;
        return travel.EndDate < now;
    }

    private async Task NotifyParticipantsAsync(Domain.Entities.Surveys.Survey survey, CancellationToken ct)
    {
        List<Guid> participantIds;
        if (survey.SourceType == "Event")
        {
            var apps = await uow.EventApplications.FindAsync(
                a => a.EventId == survey.SourceId!.Value && a.Status == "approved", ct);
            participantIds = apps.Select(a => a.ParticipantId).Distinct().ToList();
        }
        else
        {
            var apps = await uow.TravelApplications.FindAsync(
                a => a.TravelId == survey.SourceId!.Value && a.Status == "approved", ct);
            participantIds = apps.Select(a => a.ParticipantId).Distinct().ToList();
        }

        if (participantIds.Count == 0) return;

        var notifications = participantIds
            .Select(pid => Domain.Entities.Notifications.Notification.Create(
                pid,
                "Anket Doldurmanız Bekleniyor",
                $"\"{survey.Title}\" anketini doldurmak için son gün: {(survey.EndDate.HasValue ? survey.EndDate.Value.ToString("dd.MM.yyyy") : "belirtilmemiş")}.",
                "survey-activation"))
            .ToList();

        await uow.Notifications.AddRangeAsync(notifications, ct);

        var lastDay = survey.EndDate.HasValue ? survey.EndDate.Value.ToString("dd.MM.yyyy") : "belirtilmemiş";
        await participantNotify.NotifyAsync(participantIds,
            $"\"{survey.Title}\" anketini doldurmanız bekleniyor. Son gün: {lastDay}.", ct);
    }
}

public class AuditLogRetentionJob(IUnitOfWork uow, IAuditService audit) : IAuditLogRetentionJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddDays(-90);
        var old    = await uow.AuditLogs.FindAsync(x => x.CreatedAt < cutoff, ct);

        var purged = 0;
        foreach (var log in old)
        {
            uow.AuditLogs.Delete(log);
            purged++;
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.BulkOperation,
            EntityType = "AuditLog",
            Module = "System",
            Description = "Audit retention purge",
            ActorUserName = "system/retention-job",
            AdditionalDataJson = JsonSerializer.Serialize(new { purged, cutoff }),
        }, ct);
    }
}
