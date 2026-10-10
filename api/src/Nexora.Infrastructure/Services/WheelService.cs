using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class WheelService(
    IUnitOfWork uow,
    IAuditService audit) : IWheelService
{
    public async Task<PagedResult<WheelDto>> GetPagedAsync(WheelListParams p, CancellationToken ct)
    {
        var paged = await uow.Wheels.GetPagedAsync(p, ct);
        return new PagedResult<WheelDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<WheelSummaryDto> GetSummaryAsync(WheelListParams p, CancellationToken ct)
        => await uow.Wheels.GetSummaryAsync(p, ct);

    public async Task<WheelDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var wheel = await uow.Wheels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Çark bulunamadı.", "WHEEL_NOT_FOUND");
        return MapDto(wheel);
    }

    public async Task<WheelDto> CreateAsync(WheelUpsertRequest req, CancellationToken ct)
    {
        var wheel = Wheel.Create(req.Title);
        wheel.SetDetails(req.Title, req.Description, req.DailySpinLimit);
        wheel.SetResidencyMode(req.ResidencyMode);
        wheel.SetPointsAlgorithm(req.PointsAlgorithmEnabled, req.PointsAlgorithmBase, req.PointsAlgorithmStep, req.PointsAlgorithmMax, req.PointsAlgorithmMaxSpins);
        wheel.SetSlices(await BuildSlicesAsync(req.Slices, ct));

        await uow.Wheels.AddAsync(wheel, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Wheel",
            EntityId = wheel.Id,
            Module = "Wheel",
            Description = $"Çark oluşturuldu: {wheel.Title}",
            NewValues = JsonSerializer.Serialize(Snapshot(wheel)),
        }, ct);

        return MapDto(wheel);
    }

    public async Task<WheelDto> UpdateAsync(Guid id, WheelUpsertRequest req, CancellationToken ct)
    {
        var wheel = await uow.Wheels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Çark bulunamadı.", "WHEEL_NOT_FOUND");

        var before = JsonSerializer.Serialize(Snapshot(wheel));
        wheel.SetDetails(req.Title, req.Description, req.DailySpinLimit);
        wheel.SetResidencyMode(req.ResidencyMode);
        wheel.SetPointsAlgorithm(req.PointsAlgorithmEnabled, req.PointsAlgorithmBase, req.PointsAlgorithmStep, req.PointsAlgorithmMax, req.PointsAlgorithmMaxSpins);
        wheel.SetSlices(await BuildSlicesAsync(req.Slices, ct));
        uow.Wheels.Update(wheel);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Wheel",
            EntityId = wheel.Id,
            Module = "Wheel",
            Description = $"Çark güncellendi: {wheel.Title}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(wheel)),
        }, ct);

        return MapDto(wheel);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var wheel = await uow.Wheels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Çark bulunamadı.", "WHEEL_NOT_FOUND");

        var giftIds = wheel.Slices.Where(s => s.GiftId.HasValue).Select(s => s.GiftId!.Value).ToHashSet();
        var otherWheels = await uow.Wheels.FindAsync(w => w.Id != id, ct);
        giftIds.ExceptWith(otherWheels.SelectMany(w => w.Slices).Where(s => s.GiftId.HasValue).Select(s => s.GiftId!.Value));

        var gifts = giftIds.Count == 0 ? [] : await uow.Gifts.FindAsync(g => giftIds.Contains(g.Id), ct);
        var pending = giftIds.Count == 0 ? [] : await uow.GiftRequests.FindAsync(r => giftIds.Contains(r.GiftId) && r.Status == GiftRequestStatus.Pending, ct);

        await uow.BeginTransactionAsync(ct);
        try
        {
            uow.GiftRequests.DeleteRange(pending);
            uow.Gifts.DeleteRange(gifts);
            uow.Wheels.Delete(wheel);
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
            Action = AuditAction.Delete,
            EntityType = "Wheel",
            EntityId = wheel.Id,
            Module = "Wheel",
            Description = gifts.Count > 0
                ? $"Çark silindi: {wheel.Title} ({gifts.Count} hediye, {pending.Count} bekleyen talep de silindi)"
                : $"Çark silindi: {wheel.Title}",
        }, ct);
    }

    public async Task<WheelDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var wheel = await uow.Wheels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Çark bulunamadı.", "WHEEL_NOT_FOUND");

        wheel.SetStatus(wheel.Status == WheelStatus.Active ? WheelStatus.Passive : WheelStatus.Active);
        uow.Wheels.Update(wheel);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Wheel",
            EntityId = wheel.Id,
            Module = "Wheel",
            Description = $"Çark durumu değiştirildi: {wheel.Title} → {wheel.Status}",
        }, ct);

        return MapDto(wheel);
    }

    private async Task<List<WheelSlice>> BuildSlicesAsync(List<WheelSliceInput> inputs, CancellationToken ct)
    {
        var giftIds = inputs
            .Where(s => s.Type == "gift" && s.GiftId is Guid g && g != Guid.Empty)
            .Select(s => s.GiftId!.Value)
            .Distinct()
            .ToList();

        var giftMap = new Dictionary<Guid, string>();
        if (giftIds.Count > 0)
        {
            var gifts = await uow.Gifts.FindAsync(g => giftIds.Contains(g.Id), ct);
            giftMap = gifts.ToDictionary(g => g.Id, g => g.Name);
        }

        var slices = new List<WheelSlice>();
        foreach (var s in inputs)
        {
            var slice = new WheelSlice
            {
                Label = (s.Label ?? "").Trim(),
                Type = s.Type,
                Value = s.Type == "points" ? s.Value : 0,
                WinRate = s.WinRate,
                Color = s.Color,
            };

            if (s.Type == "gift" && s.GiftId is Guid gid && gid != Guid.Empty)
            {
                if (!giftMap.TryGetValue(gid, out var giftName))
                    throw new ConflictException("Seçilen hediye bulunamadı.", "GIFT_NOT_FOUND");
                slice.GiftId = gid;
                slice.GiftName = giftName;
            }

            slices.Add(slice);
        }

        return slices;
    }

    private static WheelDto MapDto(Wheel w)
        => new(
            w.Id,
            w.Title,
            w.Description,
            w.Slices.Select(s => new WheelSliceDto(s.Label, s.Type, s.Value, s.WinRate, s.Color, s.GiftId, s.GiftName)).ToList(),
            w.DailySpinLimit,
            w.Status.ToString(),
            w.TotalSpins,
            w.CreatedAt,
            w.PointsAlgorithmEnabled,
            w.PointsAlgorithmBase,
            w.PointsAlgorithmStep,
            w.PointsAlgorithmMax,
            w.PointsAlgorithmMaxSpins,
            w.ResidencyMode);

    private static object Snapshot(Wheel w) => new
    {
        w.Title,
        SliceCount = w.Slices.Count,
        Status = w.Status.ToString(),
        w.TotalSpins,
    };
}
