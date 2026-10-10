using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class GiftApplicationService(
    IUnitOfWork uow,
    ILoyaltyService loyalty,
    IGiftRequestNotifier notifier,
    IAuditService audit,
    ICurrentUser currentUser,
    IRedisService redis,
    Microsoft.Extensions.Configuration.IConfiguration config) : IGiftApplicationService
{
    public async Task<GiftRequestDto> ApplyAsync(Guid giftId, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Hediye başvurusu için giriş yapmalısınız.", "UNAUTHENTICATED");

        // P0-6 düzeltmesi (NEXORA_KAPSAMLI_DENETIM_KONSOLIDE_2026-08-31.md): Ödül talebi
        // (LoyaltyService.RedeemRewardAsync) katılımcı bazlı "loyalty:redeem-lock:{participantId}"
        // kilidini alıyordu, ama hediye başvurusu (burası) SADECE hediye bazlı
        // "wheel:gift-lock:{giftId}" kilidini alıyordu. İki yol farklı kilit anahtarları
        // kullandığından birbirini serileştirmiyordu: aynı katılımcı için eşzamanlı bir "ödül
        // talebi" (RedeemRewardAsync) ile bir "hediye başvurusu" (burası) isteği, ikisi de
        // bakiye kontrolünü aynı anda "yeterli" görüp geçebiliyor, toplam harcama katılımcının
        // puan bakiyesini negatife düşürebiliyordu (rapordaki kanıt: bakiye 1100 iken 990+1000
        // puanlık iki eşzamanlı harcama ikisi de başarılı olup bakiyeyi -890'a düşürdü).
        //
        // Düzeltme: burası da katılımcı bazlı "loyalty:redeem-lock:{participantId}" kilidini
        // DIŞTA — RedeemRewardAsync ile BİREBİR AYNI SIRADA (önce katılımcı kilidi) — alıyor.
        // Böylece aynı katılımcının tüm puan harcama yolları (ödül talebi, hediye başvurusu)
        // tek katılımcı-bazlı kilitte serileşiyor. Hediye bazlı "wheel:gift-lock:{giftId}"
        // kilidi İÇTE korunuyor: bu kilit SpinService.SpinAsync ile paylaşılan, FARKLI
        // katılımcıların aynı hediyeye çark/başvuru yarışını (stok/WinnerPattern sırası)
        // önleyen ayrı bir kaynak — participant-lock onun yerini tutmuyor.
        //
        // Deadlock riski değerlendirmesi: sistemde "wheel:gift-lock:*" kilidini önce alıp
        // SONRA "loyalty:redeem-lock:*" kilidini almaya çalışan hiçbir yol yok.
        // RedeemRewardAsync sadece loyalty:redeem-lock:{participantId} → loyalty:redeem-lock:
        // reward:{rewardId} sırasını kullanıyor (wheel:gift-lock'a hiç dokunmuyor).
        // SpinService.SpinAsync sadece wheel:spin-lock:{citizenId}:{wheelId} → wheel:gift-lock:
        // {gid} sırasını kullanıyor (loyalty:redeem-lock'a hiç dokunmuyor). Bu servis de aynı
        // "önce katılımcı/loyalty kilidi, sonra hediye kilidi" sırasını izlediği için hiçbir
        // yol tersine kilitleme yapmıyor — ABBA tipi bir döngüsel bekleme (deadlock) oluşmaz.
        var participantLock = $"loyalty:redeem-lock:{participantId}";
        var participantLockToken = await redis.TryAcquireLockAsync(participantLock, TimeSpan.FromSeconds(10), ct);
        if (participantLockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        try
        {
            var lockKey = $"wheel:gift-lock:{giftId}";
            var lockToken = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(10), ct);
            if (lockToken is null)
                throw new ConflictException("Bu hediye için yoğun talep var, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

            try
            {
                var gift = await uow.Gifts.GetByIdAsync(giftId, ct)
                    ?? throw new NotFoundException("Hediye bulunamadı.", "GIFT_NOT_FOUND");

                if (gift.Status != GiftStatus.Active)
                    throw new ConflictException("Bu hediye şu anda başvuruya kapalı.", "GIFT_NOT_ACTIVE");

                var applicant = await uow.Participants.GetByIdAsync(participantId, ct)
                    ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");
                var residencyViolation = Nexora.Domain.Common.EligibilityRules.CheckResidency(
                    gift.ResidencyMode, applicant, null, config["Residency:SultangaziDistrictCode"] ?? Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode);
                if (residencyViolation is not null)
                    throw new ConflictException(residencyViolation.Message, residencyViolation.ErrorCode);

                // Stok kontrolü SADECE AwardedCount'a (yalnızca admin onayında artan sayaç) değil,
                // henüz onaylanmamış (Pending) başvuruları da sayarak yapılıyor — aksi halde stok
                // fiilen dolu olsa bile yeni başvurular "kabul edildi" görünüp sonradan admin
                // onayında toplu reddediliyordu (bkz. yukarıdaki yorum).
                var pendingCount = await uow.GiftRequests.CountAsync(
                    r => r.GiftId == giftId && r.Status == GiftRequestStatus.Pending, ct);
                if (gift.AwardedCount + pendingCount >= gift.StockLimit)
                    throw new ConflictException("Bu hediyenin stoğu tükendi.", "GIFT_STOCK_EXCEEDED");

                var hasPending = await uow.GiftRequests.AnyAsync(
                    r => r.GiftId == giftId && r.ParticipantId == participantId && r.Status == GiftRequestStatus.Pending, ct);
                if (hasPending)
                    throw new ConflictException("Bu hediye için bekleyen bir başvurunuz zaten var.", "DUPLICATE_PENDING_REQUEST");

                var balance = await loyalty.GetBalanceAsync(participantId, ct);
                if (balance < gift.Points)
                    throw new ConflictException("Bu hediye için yeterli puanınız yok.", "INSUFFICIENT_POINTS");

                var name = applicant.FullName;
                var tc = applicant.Tckn;
                var phone = applicant.Phone ?? "";

                var existingOrders = await uow.GiftRequests.FindAsync(r => r.GiftId == giftId, ct);
                var orderNumber = (existingOrders.Count == 0 ? 0 : existingOrders.Max(r => r.OrderNumber)) + 1;

                // WinnerPattern (kazanan sırası) kontrolü SpinService.SpinAsync ile birebir aynı
                // mantıkla yapılıyor: gift.WinnerPattern listesindeki sıra numaraları "gerçek
                // kazanan" sayılır. Önceden bu yol her zaman isWinner=false gönderiyordu — aynı
                // hediyeye çark üzerinden başvuran biri WinnerPattern'e göre kazanan sayılırken,
                // puanla direkt başvuran aynı sıradaki kişi hiçbir zaman kazanan sayılmıyordu.
                // Bu, aynı kural için iki giriş yolu arasında tutarsız davranışa yol açıyordu
                // (bkz. loyalty-ecosystem-audit-2026-08-04 bulgusu).
                var isWinner = gift.WinnerPattern.Contains(orderNumber);

                GiftRequest request;
                await uow.BeginTransactionAsync(ct);
                try
                {
                    request = GiftRequest.Create(giftId, gift.Name, gift.Points, name, tc, phone,
                        orderNumber, isWinner, DateTime.UtcNow, "application", participantId);
                    await uow.GiftRequests.AddAsync(request, ct);

                    var newBalance = balance - gift.Points;
                    var tx = LoyaltyTransaction.Create(participantId, "gift-application",
                        $"Hediye başvurusu: {gift.Name}", -gift.Points, newBalance, request.Id.ToString());
                    await uow.LoyaltyTransactions.AddAsync(tx, ct);

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
                    Action = AuditAction.Create,
                    EntityType = "GiftRequest",
                    EntityId = request.Id,
                    Module = "Wheel",
                    Description = $"Puanla hediye başvurusu: {name} → {gift.Name}",
                    ActorUserId = participantId,
                    ActorUserName = name,
                }, ct);

                await notifier.NotifyNewRequestAsync(request, ct);

                return request.ToDto();
            }
            finally
            {
                await redis.ReleaseLockAsync(lockKey, lockToken, ct);
            }
        }
        finally
        {
            await redis.ReleaseLockAsync(participantLock, participantLockToken, ct);
        }
    }
}
