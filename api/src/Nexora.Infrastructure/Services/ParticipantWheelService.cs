using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.ParticipantWheels;
using Nexora.Application.Features.ParticipantWheels.Dtos;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantWheelService(IUnitOfWork uow, ICurrentUser currentUser, IRedisService redis, ILoyaltyService loyalty) : IParticipantWheelService
{
    public async Task<PagedResult<CitizenWheelDto>> GetWheelsAsync(CitizenWheelListParams p, CancellationToken ct)
    {
        var listParams = new Nexora.Application.Features.Wheels.Dtos.WheelListParams
        {
            Page = p.PageResolved.ToString(),
            Limit = p.LimitResolved.ToString(),
            Search = p.Search,
            Status = "Active",
            Sort = p.Sort,
            Order = p.Order,
        };

        var paged = await uow.Wheels.GetPagedAsync(listParams, ct);

        var citizenId = currentUser.Id;
        var today = TurkeyTime.TodayDate().ToString("yyyyMMdd");

        var spinTasks = paged.Items.Select(async w =>
        {
            int? remaining = null;
            if (w.DailySpinLimit > 0 && citizenId.HasValue)
            {
                var key = $"wheel:spins:{w.Id}:{citizenId.Value}:{today}";
                var used = await redis.GetAsync<int>(key, ct);
                remaining = Math.Max(0, w.DailySpinLimit - used);
            }
            return WheelToDto(w, remaining);
        });

        var items = (await Task.WhenAll(spinTasks)).ToList();

        return new PagedResult<CitizenWheelDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<PagedResult<CitizenGiftRequestDto>> GetMyGiftsAsync(CitizenGiftRequestListParams p, CancellationToken ct)
    {
        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;

        var participantId = participant?.Id ?? Guid.Empty;

        var all = await uow.GiftRequests.FindAsync(gr => gr.ParticipantId == participantId, ct);

        var query = all.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(gr => gr.Status.ToString().Equals(p.Status, StringComparison.OrdinalIgnoreCase));

        query = (p.Sort?.ToLowerInvariant(), p.Order?.ToLowerInvariant()) switch
        {
            ("requestedat", "asc") => query.OrderBy(gr => gr.RequestedAt),
            _ => query.OrderByDescending(gr => gr.RequestedAt),
        };

        var total = query.Count();
        var items = query.Skip((p.PageResolved - 1) * p.LimitResolved).Take(p.LimitResolved).Select(GiftRequestToDto).ToList();

        return new PagedResult<CitizenGiftRequestDto>
        {
            Items = items,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<AvailableGiftsResultDto> GetAvailableGiftsAsync(CancellationToken ct)
    {
        var citizenId = currentUser.Id
            ?? throw new ForbiddenException("Hediyeleri görüntülemek için giriş yapmalısınız.", "UNAUTHENTICATED");

        var balance = await loyalty.GetBalanceAsync(citizenId, ct);

        var activeGifts = await uow.Gifts.FindAsync(g => g.Status == GiftStatus.Active, ct);

        var myPending = await uow.GiftRequests.FindAsync(
            r => r.ParticipantId == citizenId && r.Status == GiftRequestStatus.Pending, ct);
        var pendingGiftIds = myPending.Select(r => r.GiftId).ToHashSet();

        // Kalan stok, GiftApplicationService.ApplyAsync'teki fiili engelleme kuralıyla
        // (AwardedCount + PendingCount >= StockLimit) AYNI formülle hesaplanıyor. Önceden
        // burada yalnızca StockLimit - AwardedCount kullanılıyordu; bu da onaylanmayı bekleyen
        // talepleri hiç saymadığı için stok fiilen tükenmiş olsa bile vatandaşa "stok var"
        // gösteriyordu (canlı testte doğrulandı: stockLimit=2, 1 bekleyen talep varken
        // remaining=2 dönüyordu — bkz. loyalty-ecosystem-audit-2026-08-04 bulgusu). Tüm aktif
        // hediyeler için tek seferde toplu bekleyen-talep sayımı yapılıyor (N+1 sorgu yerine).
        var allPendingCounts = await uow.GiftRequests.FindAsync(
            r => r.Status == GiftRequestStatus.Pending, ct);
        var pendingCountByGift = allPendingCounts
            .GroupBy(r => r.GiftId)
            .ToDictionary(g => g.Key, g => g.Count());

        var gifts = activeGifts
            .OrderBy(g => g.Name)
            .Select(g => new AvailableGiftDto(
                g.Id,
                g.Name,
                g.Points,
                g.ImageUrl,
                Math.Max(0, g.StockLimit - g.AwardedCount - pendingCountByGift.GetValueOrDefault(g.Id, 0)),
                pendingGiftIds.Contains(g.Id)))
            .ToList();

        return new AvailableGiftsResultDto(balance, gifts);
    }

    private static CitizenWheelDto WheelToDto(Wheel w, int? remainingSpinsToday = null) => new(
        w.Id,
        w.Title,
        w.Description,
        w.Slices.Select(s => new CitizenWheelSliceDto(
            s.Label, s.Type, s.Value, s.WinRate, s.Color, s.GiftId, s.GiftName)).ToList(),
        w.DailySpinLimit,
        remainingSpinsToday,
        w.Status.ToString(),
        w.CreatedAt);

    private static CitizenGiftRequestDto GiftRequestToDto(GiftRequest gr) => new(
        gr.Id,
        gr.GiftId,
        gr.GiftName,
        gr.GiftPoints,
        gr.OrderNumber,
        gr.IsWinner,
        gr.Status.ToString(),
        gr.RequestedAt,
        gr.ApprovedAt,
        gr.RejectedAt,
        gr.RejectReason);
}
