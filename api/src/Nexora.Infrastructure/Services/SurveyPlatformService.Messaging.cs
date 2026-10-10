using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-09-01): "anketörlere / saha görevlilerine toplu mesaj
/// gönderilebilsin, SMS de gönderebilelim, uygulama içinde anlık açılan popup
/// olsun ve okudum demeden kapatamasın."
///
/// Bu dosya anketör iletişimini yönetir:
///  • Hedef seçimi: doğrudan anketör listesi veya bir ankete atanmış tüm anketörler.
///  • Kanallar: uygulama içi bildirim (zil), zorunlu onaylı popup, SMS.
///  • Kapsam: mevcut saha uçlarıyla aynı — "yalnızca kendi anketleri" yetkisindeki
///    bir kullanıcı, kapsamı dışındaki anketin anketörlerine mesaj gönderemez.
/// </summary>
public partial class SurveyPlatformService
{
    /// <summary>Saha görevi katılımcıya atandığında bu tip kullanılır; bildirim zilinde ayırt edilir.</summary>
    public const string FieldTaskNotificationType = "survey-field-task";

    /// <summary>Anketöre gönderilen duyuru/mesaj tipi.</summary>
    public const string FieldAnnouncementType = "survey-field-announcement";

    public async Task<SurveyInterviewerMessageResult> SendInterviewerMessageAsync(
        SurveyInterviewerMessageRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        if (string.IsNullOrWhiteSpace(req.Title)) throw new ConflictException("Başlık boş olamaz.", "TITLE_REQUIRED");
        if (string.IsNullOrWhiteSpace(req.Body)) throw new ConflictException("Mesaj metni boş olamaz.", "BODY_REQUIRED");
        if (!req.Notify && !req.Sms) throw new ConflictException("En az bir kanal seçin (bildirim veya SMS).", "NO_CHANNEL");
        // Zorunlu onay yalnızca uygulama içi popup ile mümkündür; SMS'te "okudum" alınamaz.
        if (req.RequiresAck && !req.Notify) throw new ConflictException("Onay istenen duyuru için bildirim kanalı açık olmalı.", "ACK_NEEDS_NOTIFY");

        var recipientIds = await ResolveInterviewerRecipientsAsync(req, ct);
        if (recipientIds.Count == 0) return new SurveyInterviewerMessageResult(0, 0, 0, 0, false);

        var title = req.Title.Trim();
        var body = req.Body.Trim();

        var notificationsCreated = 0;
        var smsSent = 0;
        var smsFailed = 0;

        if (req.Notify)
        {
            foreach (var recipientId in recipientIds)
            {
                await notifications.CreateAsync(recipientId, title, body, FieldAnnouncementType,
                    req.SurveyId.HasValue ? "Survey" : null, req.SurveyId?.ToString(), req.RequiresAck, ct);
                notificationsCreated++;
            }
        }

        if (req.Sms)
        {
            var phones = await db.Participants
                .Where(p => recipientIds.Contains(p.Id) && !p.IsDeleted && p.Phone != null && p.Phone != "")
                .Select(p => new { p.Id, p.Phone })
                .ToListAsync(ct);

            foreach (var target in phones)
            {
                try
                {
                    if (await dispatcher.SendSmsAsync(target.Phone!, $"{title}: {body}", ct))
                        smsSent++;
                    else
                        smsFailed++;
                }
                catch (Exception ex)
                {
                    // Tek bir numaranın hatası toplu gönderimi durdurmamalı; sonuçta raporlanır.
                    smsFailed++;
                    log.LogStepResult("SurveyInterviewerSmsFailed", new { target.Id, ex.Message });
                }
            }
        }

        log.LogStepResult(nameof(SendInterviewerMessageAsync), new
        {
            recipients = recipientIds.Count, notificationsCreated, smsSent, smsFailed, req.RequiresAck,
        });

        return new SurveyInterviewerMessageResult(
            recipientIds.Count, notificationsCreated, smsSent, smsFailed,
            req.Sms && smsSent > 0 && sms.IsMockMode);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-02): "gönderilen bildirimlerin ... adminde o bildirimi o
    /// kişinin okuduğu görülmeli." Anketörlere gönderilen duyuru/mesaj ve saha görevi
    /// bildirimlerini başlık+gönderim zamanına göre gruplayıp, her alıcı için okundu ve
    /// "Okudum" onay bilgisiyle döner.
    ///
    /// Kapsam kuralı: yalnızca <b>anketör bildirimi</b> tipleri listelenir; vatandaşın
    /// diğer bildirimleri (etkinlik, başvuru vb.) bu ekrana sızmaz.
    /// </summary>
    public async Task<List<SurveyNotificationSummaryDto>> GetInterviewerNotificationReceiptsAsync(
        Guid? interviewerId, Guid? surveyId, int take, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        var limit = Math.Clamp(take <= 0 ? 50 : take, 1, 200);

        // Hedef anketör kümesi: belirli bir kişi, bir ankete atanmış anketörler ya da
        // saha görevi olan tüm katılımcı anketörler.
        var scopeIds = new HashSet<Guid>();
        if (interviewerId.HasValue) scopeIds.Add(interviewerId.Value);

        if (surveyId.HasValue)
        {
            await EnsureSurveyOwnershipAsync(surveyId.Value, ct);
            var assigned = await db.SurveyFieldTasks
                .Where(t => t.SurveyId == surveyId.Value && !t.IsDeleted && t.InterviewerType == "participant")
                .Select(t => t.InterviewerId).Distinct().ToListAsync(ct);
            foreach (var id in assigned) scopeIds.Add(id);
        }

        if (scopeIds.Count == 0)
        {
            var all = await db.SurveyFieldTasks
                .Where(t => !t.IsDeleted && t.InterviewerType == "participant")
                .Select(t => t.InterviewerId).Distinct().ToListAsync(ct);
            foreach (var id in all) scopeIds.Add(id);
        }

        if (scopeIds.Count == 0) return [];

        var types = new[] { FieldAnnouncementType, FieldTaskNotificationType };
        var rows = await db.Notifications.AsNoTracking()
            .Where(n => !n.IsDeleted && scopeIds.Contains(n.RecipientId) && types.Contains(n.Type))
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit * 25)
            .ToListAsync(ct);

        if (rows.Count == 0) return [];

        var names = await db.Participants.AsNoTracking()
            .Where(p => scopeIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FullName })
            .ToDictionaryAsync(p => p.Id, p => p.FullName, ct);

        // Toplu gönderimde her alıcı için ayrı bir Notification satırı oluşur; aynı duyuruyu
        // tek satırda göstermek için başlık + dakikaya yuvarlanmış gönderim zamanı ile gruplanır.
        return rows
            .GroupBy(n => new
            {
                n.Title,
                n.Type,
                Minute = new DateTime(n.CreatedAt.Year, n.CreatedAt.Month, n.CreatedAt.Day,
                    n.CreatedAt.Hour, n.CreatedAt.Minute, 0, n.CreatedAt.Kind),
            })
            .OrderByDescending(g => g.Key.Minute)
            .Take(limit)
            .Select(g =>
            {
                var receipts = g
                    .OrderBy(n => names.TryGetValue(n.RecipientId, out var nm) ? nm : string.Empty)
                    .Select(n => new SurveyNotificationReceiptDto(
                        n.Id,
                        n.RecipientId,
                        names.TryGetValue(n.RecipientId, out var nm) ? nm : "Bilinmeyen anketör",
                        n.Title,
                        n.Body,
                        n.Type,
                        n.CreatedAt,
                        n.IsRead,
                        n.ReadAt,
                        n.RequiresAck,
                        n.AcknowledgedAt))
                    .ToList();

                return new SurveyNotificationSummaryDto(
                    g.Key.Title,
                    g.Key.Type,
                    g.Min(n => n.CreatedAt),
                    g.Any(n => n.RequiresAck),
                    receipts.Count,
                    receipts.Count(r => r.IsRead),
                    receipts.Count(r => r.AcknowledgedAt.HasValue),
                    receipts);
            })
            .ToList();
    }

    /// <summary>
    /// Alıcıları çözer. Anket üzerinden hedefleme yapılıyorsa yalnızca o ankete saha
    /// görevi atanmış <b>katılımcı</b> anketörler alınır: admin kullanıcıların vatandaş
    /// bildirimi/telefonu bu akışta yoktur.
    /// </summary>
    private async Task<List<Guid>> ResolveInterviewerRecipientsAsync(
        SurveyInterviewerMessageRequest req, CancellationToken ct)
    {
        var ids = new HashSet<Guid>(req.InterviewerIds ?? []);

        if (req.SurveyId.HasValue)
        {
            await EnsureSurveyOwnershipAsync(req.SurveyId.Value, ct);
            var assigned = await db.SurveyFieldTasks
                .Where(t => t.SurveyId == req.SurveyId.Value && !t.IsDeleted && t.InterviewerType == "participant")
                .Select(t => t.InterviewerId)
                .Distinct()
                .ToListAsync(ct);
            foreach (var id in assigned) ids.Add(id);
        }

        if (ids.Count == 0) return [];

        // Doğrudan verilen kimlikler arasında yalnızca gerçek katılımcılar kalsın;
        // silinmiş veya var olmayan kimlik sessizce elenir.
        return await db.Participants
            .Where(p => ids.Contains(p.Id) && !p.IsDeleted)
            .Select(p => p.Id)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "yeni anket eklendiğinde bunları da takip edecek,
    /// bunların tamamı kullanıcıya bildirilecek." Saha görevi atandığında anketöre
    /// otomatik bildirim düşer; görev listesini açmasını beklemeye gerek kalmaz.
    /// Bildirim gönderimi asıl işlemi (görev ataması) bozmamalıdır, bu yüzden hatası yutulur.
    /// </summary>
    private async Task NotifyFieldTaskAssignedAsync(SurveyFieldTaskDto dto, string interviewerType, CancellationToken ct)
    {
        if (!string.Equals(interviewerType, "participant", StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            await notifications.CreateAsync(
                dto.InterviewerId,
                "Yeni saha görevi atandı",
                $"{dto.SurveyTitle} · {dto.Neighborhood}" +
                (dto.TargetCount > 0 ? $" · hedef {dto.TargetCount} anket" : string.Empty),
                FieldTaskNotificationType,
                "SurveyFieldTask", dto.Id.ToString(), false, ct);
        }
        catch (Exception ex)
        {
            log.LogStepResult("SurveyFieldTaskNotifyFailed", new { dto.Id, dto.InterviewerId, ex.Message });
        }
    }
}
