using Nexora.Application.Common.Repositories;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.TopMenu;
using Nexora.Application.Features.TopMenu.Dtos;
using Nexora.Application.Features.TopMenu.Requests;
using Nexora.Domain.Entities.AppMenu;
using Nexora.Application.Common.Exceptions;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class TopMenuService(IUnitOfWork uow, IAuditService audit) : ITopMenuService
{
    public async Task<List<TopMenuItemDto>> GetAllAsync(CancellationToken ct)
    {
        var items = await uow.TopMenuItems.GetAllOrderedAsync(ct);
        return items.Select(ToDto).ToList();
    }

    public async Task<List<TopMenuItemDto>> GetPublicAsync(CancellationToken ct)
    {
        var items = await uow.TopMenuItems.GetVisibleOrderedAsync(ct);
        return items.Select(ToDto).ToList();
    }

    public async Task<TopMenuItemDto> CreateAsync(CreateTopMenuItemRequest req, CancellationToken ct)
    {
        var nextOrder = await uow.TopMenuItems.MaxOrderAsync(ct) + 1;
        var item = TopMenuItem.Create(req.Title, req.Icon, req.IconType, req.Color,
            req.LinkType, req.LinkTarget, req.OpenInBlank, nextOrder);
        await uow.TopMenuItems.AddAsync(item, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "TopMenuItem",
            EntityId = item.Id,
            Module = "TopMenu",
            Description = $"Üst menü öğesi oluşturuldu: {item.Title}",
        }, ct);

        return ToDto(item);
    }

    public async Task<TopMenuItemDto> UpdateAsync(Guid id, UpdateTopMenuItemRequest req, CancellationToken ct)
    {
        var item = await uow.TopMenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.");
        var oldTitle = item.Title;
        item.Update(req.Title, req.Icon, req.IconType, req.Color,
            req.LinkType, req.LinkTarget, req.OpenInBlank, req.IsVisible, req.Order);
        uow.TopMenuItems.Update(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "TopMenuItem",
            EntityId = item.Id,
            Module = "TopMenu",
            Description = $"Üst menü öğesi güncellendi: {oldTitle} -> {item.Title}",
        }, ct);

        return ToDto(item);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var item = await uow.TopMenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.");
        uow.TopMenuItems.Delete(item);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "TopMenuItem",
            EntityId = item.Id,
            Module = "TopMenu",
            Description = $"Üst menü öğesi silindi: {item.Title}",
        }, ct);
    }

    public async Task ReorderAsync(ReorderTopMenuItemsRequest req, CancellationToken ct)
    {
        var items = await uow.TopMenuItems.GetAllOrderedAsync(ct);
        var lookup = items.ToDictionary(x => x.Id.ToString());

        // 2026-07-30 denetiminde eklendi: istek sadece KISMİ bir ID listesi içerdiğinde
        // (örn. drag&drop sırasında filtrelenmiş bir görünümden gelen bir alt küme),
        // önceki kod istekte OLMAYAN öğelerin Order'ına hiç dokunmuyordu ama isteğe DAHİL
        // olanlara 0'dan başlayan yeni sıra veriyordu — bu da çakışan (duplicate) Order
        // değerleri üretip tüm listenin sıralamasını bozuyordu. Düzeltme: istekte olan
        // öğeler önce (0..k-1), istekte OLMAYAN öğeler kendi aralarındaki mevcut göreli
        // sırayı koruyarak sonra (k..n-1) yerleştirilir — çakışma imkansız hale gelir.
        var requestedIds = new HashSet<string>(req.OrderedIds);
        var nextOrder = 0;

        foreach (var id in req.OrderedIds)
        {
            if (!lookup.TryGetValue(id, out var item)) continue;
            item.Update(item.Title, item.Icon, item.IconType, item.Color,
                item.LinkType, item.LinkTarget, item.OpenInBlank, item.IsVisible, nextOrder++);
            uow.TopMenuItems.Update(item);
        }

        foreach (var item in items.Where(x => !requestedIds.Contains(x.Id.ToString())))
        {
            item.Update(item.Title, item.Icon, item.IconType, item.Color,
                item.LinkType, item.LinkTarget, item.OpenInBlank, item.IsVisible, nextOrder++);
            uow.TopMenuItems.Update(item);
        }

        await uow.SaveChangesAsync(ct);
    }

    private static TopMenuItemDto ToDto(TopMenuItem i)
        => new(i.Id.ToString(), i.Title, i.Icon, (int)i.IconType, i.Color,
               (int)i.LinkType, i.LinkTarget, i.OpenInBlank, i.IsVisible, i.Order);
}
