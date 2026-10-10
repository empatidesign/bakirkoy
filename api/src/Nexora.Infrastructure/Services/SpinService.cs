using Nexora.Application.Common.Exceptions;
using Nexora.Domain.Common;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SpinService(
    IUnitOfWork uow,
    IRedisService redis,
    ICurrentUser currentUser,
    IAuditService audit,
    IGiftRequestNotifier notifier,
    Microsoft.Extensions.Configuration.IConfiguration config) : ISpinService
{
    private string SultangaziDistrictCode => config["Residency:SultangaziDistrictCode"] ?? ResidencyPolicy.DefaultSultangaziDistrictCode;

    public async Task<WheelSpinResultDto> SpinAsync(Guid wheelId, CancellationToken ct)
    {
        var citizenId = currentUser.Id
            ?? throw new ForbiddenException("Çark çevirmek için giriş yapmalısınız.", "UNAUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(citizenId, ct)
            ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var lockKey = $"wheel:spin-lock:{citizenId}:{wheelId}";
        var lockToken = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(10), ct);
        if (lockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        string? giftLockKey = null;
        string? giftLockToken = null;

        try
        {
            var wheel = await uow.Wheels.GetByIdAsync(wheelId, ct)
                ?? throw new NotFoundException("Çark bulunamadı.", "WHEEL_NOT_FOUND");
            if (wheel.Status != WheelStatus.Active)
                throw new ConflictException("Bu çark şu anda aktif değil.", "WHEEL_NOT_ACTIVE");
            if (wheel.Slices.Count == 0)
                throw new ConflictException("Bu çarkta tanımlı dilim yok.", "WHEEL_NO_SLICES");

            var residencyViolation = EligibilityRules.CheckResidency(wheel.ResidencyMode, participant, null, SultangaziDistrictCode);
            if (residencyViolation is not null)
                throw new ConflictException(residencyViolation.Message, residencyViolation.ErrorCode);

            var dayKey = $"wheel:spins:{wheel.Id}:{citizenId}:{TurkeyTime.TodayDate():yyyyMMdd}";
            var usedToday = await redis.GetAsync<int>(dayKey, ct);
            if (wheel.DailySpinLimit > 0 && usedToday >= wheel.DailySpinLimit)
                throw new ConflictException("Bugünkü çevirme hakkınız doldu. Yarın tekrar deneyebilirsiniz.", "DAILY_SPIN_LIMIT_REACHED");

            var slice = PickByWinRate(wheel.Slices);

            // Kullanıcı kuralı (2026-10-05):
            // 1. 250 puan (en yüksek puan, tek) ortalama her 150 çevirmede 1 kez gelebilir.
            // 2. 100 puan (yüksek puan) ortalama her 100 çevirmede 1 kez gelebilir.
            // 3. Büyük sayılar (>= 100 puan) aynı kişiye bir daha denk gelmez; aktif olduğu sürece herkes yüksek puanı yalnız 1 kere kazanabilir.
            if (slice.Type == "points" && slice.Value >= 100)
            {
                var highWinKey = $"wheel:high-win:{wheel.Id}:{citizenId}";
                var alreadyWonHigh = await redis.GetAsync<bool>(highWinKey, ct);

                bool allowHigh = !alreadyWonHigh;
                if (allowHigh)
                {
                    if (slice.Value >= 250)
                    {
                        // 150 çevirmede 1 kez gelme olasılığı
                        allowHigh = Random.Shared.Next(150) == 0;
                    }
                    else if (slice.Value >= 100)
                    {
                        // 100 çevirmede 1 kez gelme olasılığı
                        allowHigh = Random.Shared.Next(100) == 0;
                    }
                }

                if (!allowHigh)
                {
                    // Standart dilimlerden seç (büyük sayılar hariç: puan < 100 veya puan dışı)
                    var standardSlices = wheel.Slices.Where(s => s.Type != "points" || s.Value < 100).ToList();
                    if (standardSlices.Count > 0)
                    {
                        slice = PickByWinRate(standardSlices);
                    }
                }
            }

            Guid? giftId = null;
            Guid? giftRequestId = null;
            int? pointsWon = null;
            GiftRequest? createdRequest = null;

            if (slice.Type == "gift" && slice.GiftId is Guid gid)
            {
                var key = $"wheel:gift-lock:{gid}";
                giftLockToken = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(10), ct);
                if (giftLockToken is null)
                    throw new ConflictException("Bu hediye için yoğun talep var, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");
                giftLockKey = key;

                var gift = await uow.Gifts.GetByIdAsync(gid, ct);
                var pendingCount = gift is null ? 0 : await uow.GiftRequests.CountAsync(
                    r => r.GiftId == gid && r.Status == GiftRequestStatus.Pending, ct);
                if (gift is null || gift.Status != GiftStatus.Active
                    || gift.AwardedCount + pendingCount >= gift.StockLimit)
                {
                    slice = FallbackSlice(wheel.Slices);
                }
                else
                {
                    var name = participant.FullName;
                    var tc = participant.Tckn;
                    var phone = participant.Phone ?? "";
                    var existingOrders = await uow.GiftRequests.FindAsync(r => r.GiftId == gid, ct);
                    var orderNumber = (existingOrders.Count == 0 ? 0 : existingOrders.Max(r => r.OrderNumber)) + 1;
                    var isWinner = gift.WinnerPattern.Contains(orderNumber);

                    var request = GiftRequest.Create(gid, gift.Name, gift.Points, name, tc, phone, orderNumber, isWinner, DateTime.UtcNow, "wheel", citizenId);
                    await uow.GiftRequests.AddAsync(request, ct);
                    giftId = gid;
                    giftRequestId = request.Id;
                    createdRequest = request;

                    var giftBalance = await uow.LoyaltyTransactions.GetBalanceAsync(citizenId, ct);
                    await uow.LoyaltyTransactions.AddAsync(
                        LoyaltyTransaction.Create(citizenId, "wheel-gift",
                            $"Çark hediyesi: {gift.Name}", 0, giftBalance, request.Id.ToString()), ct);
                }
            }

            if (slice.Type == "points" && slice.Value > 0)
            {
                var algorithmPoints = wheel.ComputeAlgorithmPoints(usedToday + 1);
                pointsWon = algorithmPoints ?? slice.Value;
                var balance = await uow.LoyaltyTransactions.GetBalanceAsync(citizenId, ct);
                var tx = LoyaltyTransaction.Create(citizenId, "wheel-spin",
                    $"Çark ödülü: {wheel.Title}", pointsWon.Value, balance + pointsWon.Value, wheel.Id.ToString());
                await uow.LoyaltyTransactions.AddAsync(tx, ct);

                if (pointsWon.Value >= 100)
                {
                    // Çark aktif olduğu sürece aynı kişi bir daha büyük ödül (>=100 puan) kazanamaz
                    var highWinKey = $"wheel:high-win:{wheel.Id}:{citizenId}";
                    await redis.SetAsync(highWinKey, true, TimeSpan.FromDays(365), ct);
                }
            }

            wheel.IncrementSpins();
            uow.Wheels.Update(wheel);
            await uow.SaveChangesAsync(ct);

            // Şansını yeniden dene geldiyse günün hakkı tükenmesin, tekrar çevirebilsin
            var isRetry = slice.Label.Contains("Yeniden Dene", StringComparison.OrdinalIgnoreCase);
            if (!isRetry)
            {
                await redis.SetAsync(dayKey, usedToday + 1, TimeSpan.FromHours(24), ct);
            }

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Create,
                EntityType = "WheelSpin",
                EntityId = wheel.Id,
                Module = "Wheel",
                Description = $"Çark çevrildi: {wheel.Title} → {slice.Label}",
                ActorUserId = citizenId,
                ActorUserName = currentUser.Name,
            }, ct);

            if (createdRequest is not null)
                await notifier.NotifyNewRequestAsync(createdRequest, ct);

            int? remainingToday = wheel.DailySpinLimit > 0
                ? Math.Max(0, wheel.DailySpinLimit - (isRetry ? usedToday : (usedToday + 1)))
                : null;
            return new WheelSpinResultDto(slice.Label, slice.Type, slice.Value, giftId, giftRequestId, pointsWon, remainingToday);
        }
        finally
        {
            if (giftLockKey is not null && giftLockToken is not null)
                await redis.ReleaseLockAsync(giftLockKey, giftLockToken, ct);
            await redis.ReleaseLockAsync(lockKey, lockToken, ct);
        }
    }

    private static WheelSlice PickByWinRate(List<WheelSlice> slices)
    {
        var total = slices.Sum(s => Math.Max(0, s.WinRate));
        if (total <= 0) return slices[Random.Shared.Next(slices.Count)];

        var r = Random.Shared.NextDouble() * total;
        double acc = 0;
        foreach (var s in slices)
        {
            acc += Math.Max(0, s.WinRate);
            if (r <= acc) return s;
        }
        return slices[^1];
    }

    // Stoğu tükenmiş bir hediye dilimine düşüldüğünde kullanılacak yedek dilim.
    // ÖNCEDEN: pass/empty tipli bir dilim yoksa slices[0]'a düşülüyordu — bu, slices[0]
    // başka bir "gift" dilimiyse, hiçbir GiftRequest oluşturulmadığı/giftId=null döndüğü
    // halde yanıtta sliceType="gift" ve o dilimin etiketiyle dönerek vatandaşa YANLIŞ
    // "hediye kazandın" görüntüsü veriyordu (kanıt: canlı test — WHEEL_ALLGIFT_TEST_TEMP
    // çarkında stoğu biten hediye dilimine düşüldüğünde giftId=null, giftRequestId=null
    // ama sliceType="gift" ve orijinal etiket dönüyordu). Aynı şekilde slices[0] bir
    // "points" diliminde olsaydı, olasılık ağırlığına uymayan puan verilmiş olacaktı.
    // Artık pass/empty yoksa, ödül vermeyen sentetik bir "empty" sonucu üretiliyor.
    private static readonly WheelSlice SyntheticEmptyFallback = new()
    {
        Label = "Bu sefer olmadı",
        Type = "empty",
        Value = 0,
        WinRate = 0,
        Color = "#94a3b8",
    };

    private static WheelSlice FallbackSlice(List<WheelSlice> slices)
        => slices.FirstOrDefault(s => s.Type is "pass" or "empty") ?? SyntheticEmptyFallback;
}
