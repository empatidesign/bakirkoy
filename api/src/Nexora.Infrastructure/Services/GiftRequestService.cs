using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class GiftRequestService(
    IUnitOfWork uow,
    IAuditService audit,
    INotificationService notifications,
    INotificationDispatcher dispatcher,
    IModuleNotificationSettingsService moduleSettings,
    ISmsService sms,
    ISmsGovernanceService smsGovernance,
    ILoyaltyService loyalty,
    ICurrentUser currentUser,
    IActivityLogger log) : IGiftRequestService
{
    public async Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct)
    {
        // BULGU (2026-09-21 uçtan uca test, K7 ile aynı desen): req.Ids null gönderildiğinde
        // NullReferenceException → çıplak 500 veriyordu.
        if (req.Ids is null || req.Ids.Count == 0) throw new ConflictException("En az bir kayıt seçmelisiniz.", "NO_TARGET");
        if (!req.Sms && !req.Notify) throw new ConflictException("En az bir kanal seçin.", "NO_CHANNEL");
        var requests = req.TargetKind == "gift"
            ? await uow.GiftRequests.FindAsync(r => req.Ids.Contains(r.GiftId), ct)
            : req.TargetKind == "giftRequest" || req.TargetKind == "request"
                ? await uow.GiftRequests.FindAsync(r => req.Ids.Contains(r.Id), ct)
                : throw new ConflictException("Geçersiz hedef türü.", "INVALID_TARGET");
        if (requests.Count == 0) return new ModuleManualMessageResultDto(0, 0, 0, false);
        var settings = await moduleSettings.GetAsync("wheel", ct);
        var template = settings.NotificationTemplates?.FirstOrDefault(t => t.Event == req.TemplateEvent)
            ?? throw new ConflictException("Şablon bulunamadı.", "TEMPLATE_NOT_FOUND");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde başarısız bir
        // istek (ör. şablon bulunamadı) bile kullanıcının günlük SMS hakkını
        // gereksiz yere tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (req.Sms) await smsGovernance.EnsureCanSendAsync("Wheel", req.TemplateEvent, req.Ids.Count, req.SmsOtp, ct);
        var smsTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.SmsBody : req.CustomText!;
        var notifyTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.NotifyBody : req.CustomText!;
        var participantIds = requests.Where(r => r.ParticipantId.HasValue).Select(r => r.ParticipantId!.Value).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => participantIds.Contains(p.Id), ct)).ToDictionary(p => p.Id, p => p);
        var recipients = 0; var smsSent = 0; var notifs = 0;
        foreach (var r in requests)
        {
            var fullName = r.CitizenName;
            var phone = r.CitizenPhone;
            Guid? notificationParticipantId = r.ParticipantId;
            if (r.ParticipantId.HasValue && participants.TryGetValue(r.ParticipantId.Value, out var participant))
            { fullName = participant.FullName; phone = participant.Phone ?? phone; }
            recipients++;
            var vars = new Dictionary<string, string?> { ["hediye"] = r.GiftName, ["sira_no"] = r.OrderNumber.ToString() };
            if (req.Notify && template.NotifyEnabled && notificationParticipantId.HasValue) { await notifications.CreateAsync(notificationParticipantId.Value, "Çark Hediye", ModuleMessageRenderer.Render(notifyTemplate, fullName, vars), "wheel-manual", ct); notifs++; }
            if (req.Sms && template.SmsEnabled && !string.IsNullOrWhiteSpace(phone))
            { try { if (await dispatcher.SendSmsAsync(phone!, ModuleMessageRenderer.Render(smsTemplate, fullName, vars), ct)) smsSent++; } catch (Exception ex) { log.LogStepResult("GiftRequestManualSmsFailed", new { r.Id, ex.Message }); } }
        }
        return new ModuleManualMessageResultDto(recipients, smsSent, notifs, req.Sms && smsSent > 0 && sms.IsMockMode);
    }
    public async Task<PagedResult<GiftRequestDto>> GetPagedAsync(GiftRequestListParams p, CancellationToken ct)
    {
        var paged = await uow.GiftRequests.GetPagedAsync(p, ct);
        return new PagedResult<GiftRequestDto>
        {
            Items = paged.Items.Select(r => r.ToDto()).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<GiftRequestSummaryDto> GetSummaryAsync(GiftRequestListParams p, CancellationToken ct)
        => await uow.GiftRequests.GetSummaryAsync(p, ct);

    public async Task<GiftRequestDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var request = await uow.GiftRequests.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");
        return request.ToDto();
    }

    // ÖNEMLİ: Approve/Reject aşağıdaki gibi başında sadece "GetByIdAsync + Status kontrolü"
    // yapıp sonra kaydediyordu — bu iki request-response arasında hiçbir kilit yoktu. Canlı
    // testte kanıtlandı (swarm gift-audit-2026-08-04): stok=1 bir hediyenin 2 Pending talebi
    // eşzamanlı /approve edildiğinde İKİSİ DE 200 döndü ve AwardedCount=1/StockLimit=1 iken
    // 2 talep "approved" oldu (stok fazladan verildi). Aynı şekilde AYNI request'e eşzamanlı
    // 2x /reject çağrısı İKİSİ DE 200 döndü ve puan iadesi 2 KEZ yazıldı (kullanıcı bedavaya
    // puan kazandı). Kök neden: her iki istek de diğeri COMMIT olmadan "Status == Pending"
    // kontrolünü geçiyordu. Diğer modüllerdeki (TravelApplicationService, EventApplicationService,
    // FacilityRegistrationService) yerleşik desenle tutarlı olacak şekilde artık transaction
    // içinde Postgres advisory lock (hediye bazlı) alınıyor.
    //
    // DİKKAT — ilk düzeltme denemesinde kilit anahtarını öğrenmek için GetByIdAsync (tracking)
    // ile bir "initial" okuma yapılıyordu; kilit alındıktan SONRA tekrar GetByIdAsync çağrılsa
    // bile EF Core'un change tracker identity map'i AYNI (bayat, Status=Pending) instance'ı
    // döndürüyordu — DB'ye ikinci kez hiç gitmiyordu. Sonuç: kilit gerçekten alınıyordu ama işe
    // yaramıyordu, double-reject canlı testte YİNE 2x puan iadesi üretti. Şimdi ilk okuma
    // GetGiftIdNoTrackingAsync (AsNoTracking, change tracker'a hiç girmiyor) ile yapılıyor;
    // kilit alındıktan sonraki GetByIdAsync artık gerçekten DB'den taze veri çekiyor.
    public async Task<GiftRequestDto> ApproveAsync(Guid id, CancellationToken ct)
    {
        var initialGiftId = await uow.GiftRequests.GetGiftIdNoTrackingAsync(id, ct)
            ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

        GiftRequest request;
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GiftLockKey(initialGiftId), ct);

            request = await uow.GiftRequests.GetByIdAsync(id, ct)
                ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

            if (request.Status != GiftRequestStatus.Pending)
                throw new ConflictException("Yalnızca bekleyen talepler onaylanabilir.", "REQUEST_NOT_PENDING");

            var gift = await uow.Gifts.GetByIdAsync(request.GiftId, ct);
            if (gift is not null)
            {
                if (gift.AwardedCount >= gift.StockLimit)
                    throw new ConflictException("Bu hediyenin stoğu dolmuş, talep onaylanamaz.", "GIFT_STOCK_EXCEEDED");
                gift.IncrementAwarded();
                uow.Gifts.Update(gift);
            }

            request.Approve(currentUser.Name);
            uow.GiftRequests.Update(request);
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Approve,
            EntityType = "GiftRequest",
            EntityId = request.Id,
            Module = "Wheel",
            Description = $"Hediye talebi onaylandı: {request.CitizenName} → {request.GiftName}",
        }, ct);

        if (request.ParticipantId is Guid approvedParticipant)
            await notifications.CreateAsync(approvedParticipant, "Hediye talebiniz onaylandı",
                $"{request.GiftName} hediyesi için talebiniz onaylandı.", "gift-result", ct);

        return request.ToDto();
    }

    public async Task<GiftRequestDto> RejectAsync(Guid id, string? reason, CancellationToken ct)
    {
        var initialGiftId = await uow.GiftRequests.GetGiftIdNoTrackingAsync(id, ct)
            ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

        GiftRequest request;
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GiftLockKey(initialGiftId), ct);

            request = await uow.GiftRequests.GetByIdAsync(id, ct)
                ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

            if (request.Status != GiftRequestStatus.Pending)
                throw new ConflictException("Yalnızca bekleyen talepler reddedilebilir.", "REQUEST_NOT_PENDING");

            request.Reject(currentUser.Name, reason);
            uow.GiftRequests.Update(request);

            if (request.Source == "application" && request.ParticipantId is Guid refundParticipant && request.GiftPoints > 0)
            {
                var balance = await loyalty.GetBalanceAsync(refundParticipant, ct);
                var refundTx = LoyaltyTransaction.Create(refundParticipant, "gift-refund",
                    $"Hediye reddi puan iadesi: {request.GiftName}", request.GiftPoints,
                    balance + request.GiftPoints, request.Id.ToString());
                await uow.LoyaltyTransactions.AddAsync(refundTx, ct);
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Reject,
            EntityType = "GiftRequest",
            EntityId = request.Id,
            Module = "Wheel",
            Description = $"Hediye talebi reddedildi: {request.CitizenName} → {request.GiftName}",
        }, ct);

        if (request.ParticipantId is Guid rejectedParticipant)
        {
            var reasonText = string.IsNullOrWhiteSpace(reason) ? "" : $" Sebep: {reason.Trim()}";
            var refundText = request.Source == "application" && request.GiftPoints > 0
                ? $" {request.GiftPoints} puanınız hesabınıza iade edildi."
                : "";
            await notifications.CreateAsync(rejectedParticipant, "Hediye talebiniz reddedildi",
                $"{request.GiftName} hediyesi için talebiniz reddedildi.{reasonText}{refundText}", "gift-result", ct);
        }

        return request.ToDto();
    }

    // Onaylanmış (Approved) bir hediye talebinin fiilen teslim edildiğini kaydeder. Önceden
    // sistemde teslimat kaydı hiç yoktu — bir GiftRequest "Approved" olduktan sonra vatandaşa
    // gerçekten verilip verilmediğini kimse takip edemiyordu (bkz. loyalty-ecosystem-audit-2026-08-04
    // P0 bulgusu). Approve/Reject ile aynı advisory-lock deseni kullanılıyor; teslimat bir para/puan
    // hareketi tetiklemiyor ama yine de eşzamanlı çağrılara karşı tutarlılık için kilitleniyor.
    public async Task<GiftRequestDto> DeliverAsync(Guid id, string? note, CancellationToken ct)
    {
        var initialGiftId = await uow.GiftRequests.GetGiftIdNoTrackingAsync(id, ct)
            ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

        GiftRequest request;
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(GiftLockKey(initialGiftId), ct);

            request = await uow.GiftRequests.GetByIdAsync(id, ct)
                ?? throw new NotFoundException("Hediye talebi bulunamadı.", "GIFT_REQUEST_NOT_FOUND");

            if (request.Status != GiftRequestStatus.Approved)
                throw new ConflictException("Yalnızca onaylanmış talepler teslim edildi olarak işaretlenebilir.", "REQUEST_NOT_APPROVED");
            if (request.DeliveredAt is not null)
                throw new ConflictException("Bu talep zaten teslim edildi olarak işaretlenmiş.", "ALREADY_DELIVERED");

            request.MarkDelivered(currentUser.Name, note);
            uow.GiftRequests.Update(request);
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "GiftRequest",
            EntityId = request.Id,
            Module = "Wheel",
            Description = $"Hediye teslim edildi: {request.CitizenName} → {request.GiftName}",
        }, ct);

        if (request.ParticipantId is Guid deliveredParticipant)
            await notifications.CreateAsync(deliveredParticipant, "Hediyeniz teslim edildi",
                $"{request.GiftName} hediyeniz teslim edildi.", "gift-result", ct);

        return request.ToDto();
    }

    private static long GiftLockKey(Guid giftId) => BitConverter.ToInt64(giftId.ToByteArray(), 0);
}
