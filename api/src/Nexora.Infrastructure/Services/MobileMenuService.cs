using Microsoft.Extensions.Options;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.MobileMenu;
using Nexora.Application.Features.MobileMenu.Dtos;
using Nexora.Domain.Entities.MobileMenu;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class MobileMenuService(
    IUnitOfWork uow,
    IFileStorageService storage,
    IOptionsMonitor<MinioSettings> minioOptions,
    IActivityLogger log,
    IAuditService audit) : IMobileMenuService
{
    public async Task<List<MobileMenuItemDto>> GetItemsAsync(CancellationToken ct)
    {
        var items = await uow.MobileMenuItems.GetAllOrderedAsync(ct);
        return items.Select(ToDto).ToList();
    }

    public async Task<MobileMenuItemDto> CreateItemAsync(CreateMobileMenuItemRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateItemAsync), new { req.Title });

        var nextOrder = await uow.MobileMenuItems.MaxOrderAsync(ct) + 1;
        var item = MobileMenuItem.Create(
            req.Title, req.Icon, req.IconType, req.Color,
            req.ColorSecondary, req.Description,
            req.LinkType, req.LinkTarget, req.GroupKey, req.GroupTitle,
            req.IsPopular, req.IsVisible, req.RequiresAuth, nextOrder);

        await uow.MobileMenuItems.AddAsync(item, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "MobileMenuItem",
            EntityId = item.Id,
            Module = "MobileMenu",
            Description = "Mobil menü öğesi eklendi.",
        }, ct);

        return ToDto(item);
    }

    public async Task<MobileMenuItemDto> UpdateItemAsync(Guid id, UpdateMobileMenuItemRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateItemAsync), new { id });

        var item = await uow.MobileMenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.", "MOBILE_MENU_ITEM_NOT_FOUND");

        item.Update(
            req.Title, req.Icon, req.IconType, req.Color,
            req.ColorSecondary, req.Description,
            req.LinkType, req.LinkTarget, req.GroupKey, req.GroupTitle,
            req.IsPopular, req.IsVisible, req.RequiresAuth);

        uow.MobileMenuItems.Update(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "MobileMenuItem",
            EntityId = item.Id,
            Module = "MobileMenu",
            Description = "Mobil menü öğesi güncellendi.",
        }, ct);

        return ToDto(item);
    }

    public async Task DeleteItemAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteItemAsync), new { id });

        var item = await uow.MobileMenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.", "MOBILE_MENU_ITEM_NOT_FOUND");

        uow.MobileMenuItems.Delete(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "MobileMenuItem",
            EntityId = item.Id,
            Module = "MobileMenu",
            Description = "Mobil menü öğesi silindi.",
        }, ct);
    }

    public async Task ReorderAsync(ReorderMobileMenuRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ReorderAsync), new { count = req.OrderedIds.Count });

        var items = await uow.MobileMenuItems.GetAllOrderedAsync(ct);
        var byId = items.ToDictionary(i => i.Id);

        // 2026-07-30 denetiminde eklendi: TopMenuService.ReorderAsync'teki aynı
        // düzeltmeyle tutarlı — kısmi ID listesi gönderildiğinde istekte OLMAYAN
        // öğeler eski Order'ında kalıp isteğe DAHİL olanlar 0'dan başlayınca
        // çakışan (duplicate) Order değerleri oluşuyordu.
        var requestedIds = new HashSet<Guid>(req.OrderedIds);
        var order = 0;
        foreach (var id in req.OrderedIds)
        {
            if (byId.TryGetValue(id, out var item))
            {
                item.SetOrder(order++);
                uow.MobileMenuItems.Update(item);
            }
        }
        foreach (var item in items.Where(i => !requestedIds.Contains(i.Id)))
        {
            item.SetOrder(order++);
            uow.MobileMenuItems.Update(item);
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "MobileMenuItem",
            EntityId = Guid.Empty,
            Module = "MobileMenu",
            Description = "Mobil menü sırası güncellendi.",
        }, ct);
    }

    public async Task<List<MobileMenuGroupDto>> GetGroupsAsync(CancellationToken ct)
    {
        var items = await uow.MobileMenuItems.GetAllOrderedAsync(ct);
        return items
            .GroupBy(i => i.GroupKey)
            .Select(g => new MobileMenuGroupDto(g.Key, g.First().GroupTitle))
            .ToList();
    }

    public async Task<List<MobileMenuBannerDto>> GetBannersAsync(CancellationToken ct)
    {
        var banners = await uow.MobileMenuBanners.GetAllAsync(ct);
        return banners.Select(ToBannerDto).ToList();
    }

    public async Task<MobileMenuBannerDto> UpsertBannerAsync(string pageKey, UpsertBannerRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpsertBannerAsync), new { pageKey });

        var banner = await uow.MobileMenuBanners.GetByPageKeyAsync(pageKey, ct);
        if (banner is null)
        {
            banner = MobileMenuBanner.Create(pageKey, req.ImageUrl, req.LinkType, req.LinkTarget, req.IsVisible, 0);
            await uow.MobileMenuBanners.AddAsync(banner, ct);
        }
        else
        {
            banner.Update(req.ImageUrl, req.LinkType, req.LinkTarget, req.IsVisible);
            uow.MobileMenuBanners.Update(banner);
        }
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "MobileMenuBanner",
            EntityId = banner.Id,
            Module = "MobileMenu",
            Description = "Mobil menü banner'ı kaydedildi.",
        }, ct);

        return ToBannerDto(banner);
    }

    public async Task DeleteBannerAsync(string pageKey, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteBannerAsync), new { pageKey });

        var banner = await uow.MobileMenuBanners.GetByPageKeyAsync(pageKey, ct)
            ?? throw new NotFoundException("Banner bulunamadı.", "MOBILE_MENU_BANNER_NOT_FOUND");

        uow.MobileMenuBanners.Delete(banner);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "MobileMenuBanner",
            EntityId = banner.Id,
            Module = "MobileMenu",
            Description = "Mobil menü banner'ı silindi.",
        }, ct);
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var converted = await WebpImageConverter.ConvertAsync(stream, fileName, contentType, ct);
        try
        {
            var result = await storage.UploadAsync(
                converted.Stream, converted.FileName, converted.ContentType, bucket, ct, keyPrefix: "mobile-menu");
            return result.Url;
        }
        finally
        {
            if (converted.OwnsStream) await converted.Stream.DisposeAsync();
        }
    }

    public async Task<PublicMenuResponse> GetPublicMenuAsync(CancellationToken ct)
    {
        var items = await uow.MobileMenuItems.GetVisibleAsync(ct);

        var groups = items
            .GroupBy(i => i.GroupKey)
            .Select(g => new PublicMenuGroupDto(
                g.Key,
                g.First().GroupTitle,
                g.OrderBy(i => i.Order).Select(ToPublicItem).ToList()))
            .ToList();

        var popular = items.Where(i => i.IsPopular).OrderBy(i => i.Order).Select(ToPublicItem).ToList();

        return new PublicMenuResponse(groups, popular);
    }

    public async Task<PublicBannerDto?> GetPublicBannerAsync(string pageKey, CancellationToken ct)
    {
        var banner = await uow.MobileMenuBanners.GetByPageKeyAsync(pageKey, ct);
        if (banner is null || !banner.IsVisible) return null;
        return new PublicBannerDto(banner.PageKey, banner.ImageUrl, banner.LinkType, banner.LinkTarget);
    }

    private static MobileMenuItemDto ToDto(MobileMenuItem i)
        => new(i.Id, i.Title, i.Icon, i.IconType, i.Color, i.ColorSecondary, i.Description,
               i.LinkType, i.LinkTarget,
               i.GroupKey, i.GroupTitle, i.IsPopular, i.IsVisible, i.RequiresAuth, i.Order);

    private static MobileMenuBannerDto ToBannerDto(MobileMenuBanner b)
        => new(b.Id, b.PageKey, b.ImageUrl, b.LinkType, b.LinkTarget, b.IsVisible, b.Order);

    private static PublicMenuItemDto ToPublicItem(MobileMenuItem i)
        => new(i.Title, i.Icon, i.IconType, i.Color, i.ColorSecondary, i.Description,
               i.LinkType, i.LinkTarget, i.IsPopular);
}
