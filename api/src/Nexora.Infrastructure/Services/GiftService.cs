using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class GiftService(
    IUnitOfWork uow,
    IAuditService audit,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions) : IGiftService
{
    public async Task<PagedResult<GiftDto>> GetPagedAsync(GiftListParams p, CancellationToken ct)
    {
        var paged = await uow.Gifts.GetPagedAsync(p, ct);
        return new PagedResult<GiftDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<GiftSummaryDto> GetSummaryAsync(GiftListParams p, CancellationToken ct)
        => await uow.Gifts.GetSummaryAsync(p, ct);

    public async Task<IReadOnlyList<GiftOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var gifts = await uow.Gifts.GetActiveAsync(ct);
        return gifts.Select(g => new GiftOptionDto(g.Id.ToString(), g.Name)).ToList();
    }

    public async Task<GiftDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var gift = await uow.Gifts.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "GIFT_NOT_FOUND");
        return MapDto(gift);
    }

    public async Task<GiftDto> CreateAsync(GiftUpsertRequest req, CancellationToken ct)
    {
        var gift = Gift.Create(req.Name);
        gift.SetDetails(req.Name, req.ImageUrl, req.Points, req.StockLimit, req.WinnerPattern ?? [], req.Description);
        gift.SetResidencyMode(req.ResidencyMode);

        await uow.Gifts.AddAsync(gift, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Gift",
            EntityId = gift.Id,
            Module = "Wheel",
            Description = $"Hediye oluşturuldu: {gift.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(gift)),
        }, ct);

        return MapDto(gift);
    }

    public async Task<GiftDto> UpdateAsync(Guid id, GiftUpsertRequest req, CancellationToken ct)
    {
        var gift = await uow.Gifts.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "GIFT_NOT_FOUND");

        var before = JsonSerializer.Serialize(Snapshot(gift));
        gift.SetDetails(req.Name, req.ImageUrl, req.Points, req.StockLimit, req.WinnerPattern ?? [], req.Description);
        gift.SetResidencyMode(req.ResidencyMode);
        uow.Gifts.Update(gift);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Gift",
            EntityId = gift.Id,
            Module = "Wheel",
            Description = $"Hediye güncellendi: {gift.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(gift)),
        }, ct);

        return MapDto(gift);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var gift = await uow.Gifts.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "GIFT_NOT_FOUND");

        var pending = await uow.GiftRequests.FindAsync(r => r.GiftId == id && r.Status == GiftRequestStatus.Pending, ct);

        await uow.BeginTransactionAsync(ct);
        try
        {
            uow.GiftRequests.DeleteRange(pending);
            uow.Gifts.Delete(gift);
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
            EntityType = "Gift",
            EntityId = gift.Id,
            Module = "Wheel",
            Description = pending.Count > 0
                ? $"Hediye silindi: {gift.Name} (bekleyen {pending.Count} talep de silindi)"
                : $"Hediye silindi: {gift.Name}",
        }, ct);
    }

    public async Task<GiftDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var gift = await uow.Gifts.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "GIFT_NOT_FOUND");

        gift.SetStatus(gift.Status == GiftStatus.Active ? GiftStatus.Passive : GiftStatus.Active);
        uow.Gifts.Update(gift);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Gift",
            EntityId = gift.Id,
            Module = "Wheel",
            Description = $"Hediye durumu değiştirildi: {gift.Name} → {gift.Status}",
        }, ct);

        return MapDto(gift);
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct);
        return result.Url;
    }

    private static GiftDto MapDto(Gift g)
        => new(g.Id, g.Name, g.ImageUrl, g.Points, g.StockLimit, g.AwardedCount,
            g.StockLimit - g.AwardedCount, g.WinnerPattern, g.Description, g.Status.ToString(), g.CreatedAt, g.ResidencyMode);

    private static object Snapshot(Gift g) => new
    {
        g.Name,
        g.Points,
        g.StockLimit,
        g.AwardedCount,
        Status = g.Status.ToString(),
    };
}
