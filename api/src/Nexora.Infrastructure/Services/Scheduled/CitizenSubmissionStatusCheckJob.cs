using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface ICitizenSubmissionStatusCheckJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kullanıcı isteği (2026-09-07): "Ulakbel'e iletilen taleplerin süresi dolmak üzereyken
/// veya süresi dolduğunda vatandaşa push bildirim gönderilsin, belirli aralıklarla
/// çalışsın (cron)". Her çalıştığında henüz sonuçlanmamış ("new"/"in_review"/"forwarded")
/// başvuruları tarayıp SLA hedef süresine (MuhtarlikReference.SlaTargetsFor, önceliğe göre
/// değişir) göre iki eşiği kontrol eder:
///   - Uyarı: geçen süre hedefin %80'ine ulaştıysa ("süresi yaklaşıyor")
///   - Aşım: geçen süre hedefi geçtiyse ("süre aşıldı")
/// Her eşik BİR KEZ bildirilir (SlaWarningNotifiedAt/SlaBreachNotifiedAt ile idempotency) —
/// bu alanlar olmadan her 15 dakikada bir aynı kayıt için tekrar tekrar bildirim giderdi.
/// Eski davranış (yalnızca audit log yazmak) korunur, üzerine push bildirimi eklenmiştir.
/// </summary>
public class CitizenSubmissionStatusCheckJob(
    IUnitOfWork uow,
    IConfiguration config,
    IAuditService audit,
    INotificationService notificationService,
    ILogger<CitizenSubmissionStatusCheckJob> logger) : ICitizenSubmissionStatusCheckJob
{
    private int StaleHours => config.GetValue("CitizenSubmissionSettings:StaleAfterHours", 24);

    public async Task RunAsync(CancellationToken ct)
    {
        var pending = await uow.CitizenSubmissions.FindAsync(
            s => s.Status == "new" || s.Status == "in_review" || s.Status == "forwarded", ct);

        var now = DateTime.UtcNow;
        var staleThreshold = now.AddHours(-StaleHours);
        var stale = pending.Where(s => s.SubmittedAt < staleThreshold).ToList();
        var contentSent = pending.Count(s => s.UlakbelTrackingNo is { Length: > 0 });

        logger.LogInformation(
            "Muhtarlik basvuru durum kontrolu: bekleyen={Pending}, icerigi gonderilmis={Sent}, bekleme suresi asilan={Stale}",
            pending.Count, contentSent, stale.Count);

        if (stale.Count > 0)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.BulkOperation,
                EntityType = nameof(CitizenSubmission),
                Module = "Muhtarlik",
                Level = AuditLogLevel.Warning,
                Description = $"Bekleyen başvuru durum kontrolü: {stale.Count} başvuru {StaleHours} saattir beklemede.",
                ActorUserName = "system/submission-status-check",
                AdditionalDataJson = JsonSerializer.Serialize(new
                {
                    pending = pending.Count,
                    contentSent,
                    stale = stale.Count,
                    trackingNos = stale.Take(50).Select(s => s.TrackingNo),
                }),
            }, ct);
        }

        await SendSlaNotificationsAsync(pending, now, ct);
    }

    private async Task SendSlaNotificationsAsync(List<CitizenSubmission> pending, DateTime now, CancellationToken ct)
    {
        var warningsSent = 0;
        var breachesSent = 0;

        // Vatandaş bildirimini kimin alacağını bulmak için TC ile Participant eşleşmesi
        // gerekir (bkz. CitizenSubmissionService.NotifyCitizenOfStatusChangeAsync — aynı
        // desen). Aynı vatandaşın birden çok başvurusu olabileceğinden TC bazında önbelleğe
        // alınır, her başvuru için ayrı ayrı sorgu atılmaz.
        var participantCache = new Dictionary<string, Guid?>();

        foreach (var s in pending)
        {
            if (string.IsNullOrWhiteSpace(s.CitizenTc)) continue;

            var (_, resolutionHours) = MuhtarlikReference.SlaTargetsFor(s.Priority);
            var elapsedHours = (now - s.SubmittedAt).TotalHours;
            var warningThresholdHours = resolutionHours * 0.8;

            var isBreached = elapsedHours >= resolutionHours || s.SlaBreachNotifiedAt is not null;
            var needsBreachNotice = elapsedHours >= resolutionHours && s.SlaBreachNotifiedAt is null;
            var needsWarningNotice = !isBreached && elapsedHours >= warningThresholdHours && s.SlaWarningNotifiedAt is null;
            if (!needsBreachNotice && !needsWarningNotice) continue;

            if (!participantCache.TryGetValue(s.CitizenTc, out var participantId))
            {
                var participant = await uow.Participants.GetByTcknAsync(s.CitizenTc, ct);
                participantId = participant?.Id;
                participantCache[s.CitizenTc] = participantId;
            }
            if (participantId is not Guid pid) continue;

            var elapsedRounded = Math.Round(elapsedHours, 1);
            if (needsBreachNotice)
            {
                await notificationService.CreateAsync(
                    pid,
                    "Başvurunuzda gecikme var",
                    $"\"{s.Title}\" başlıklı başvurunuzun hedef çözüm süresi ({resolutionHours} saat) aşıldı, " +
                    $"şu an {elapsedRounded} saattir işlemde. Takip No: {s.TrackingNo}.",
                    "submission", "citizen-submission", s.Id.ToString(), null, null, "sla_breach", ct);
                // ULAK-03 (A): dar ExecuteUpdate — yalnız SLA işareti yazılır; iletim alanları (eşzamanlı
                // gönderim tamamlanmışsa trackingNo/state/attempt-id) ASLA bu yolla ezilmez.
                await uow.CitizenSubmissions.MarkSlaBreachNotifiedAsync(s.Id, ct);
                breachesSent++;
            }
            else
            {
                await notificationService.CreateAsync(
                    pid,
                    "Başvurunuzun süresi yaklaşıyor",
                    $"\"{s.Title}\" başlıklı başvurunuz {elapsedRounded} saattir işlemde, " +
                    $"hedef çözüm süresi {resolutionHours} saat. Takip No: {s.TrackingNo}.",
                    "submission", "citizen-submission", s.Id.ToString(), null, null, "sla_warning", ct);
                await uow.CitizenSubmissions.MarkSlaWarningNotifiedAsync(s.Id, ct);
                warningsSent++;
            }
        }

        if (warningsSent > 0 || breachesSent > 0)
            logger.LogInformation(
                "Muhtarlik SLA bildirimleri gonderildi: uyari={Warnings}, asim={Breaches}",
                warningsSent, breachesSent);
    }
}
