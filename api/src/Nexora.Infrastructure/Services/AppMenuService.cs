using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.AppMenu;
using Nexora.Application.Features.AppMenu.Dtos;
using Nexora.Application.Features.AppMenu.Requests;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Services;

public class AppMenuService(IUnitOfWork uow, IActivityLogger log) : IAppMenuService
{

    public async Task<List<SystemModuleDto>> GetSystemModulesAsync(CancellationToken ct)
    {
        var modules = await uow.SystemModules.GetAllOrderedAsync(ct);
        return modules.Select(ToDto).ToList();
    }

    public async Task<SystemModuleDto> UpsertSystemModuleAsync(string key, UpsertSystemModuleRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpsertSystemModuleAsync), new { key });
        var existing = await uow.SystemModules.GetByKeyAsync(key, ct);
        if (existing is null)
        {
            var nextOrder = await uow.SystemModules.MaxAdminOrderAsync(ct) + 1;
            existing = SystemModule.Create(key, req.Label, req.Icon, req.Color,
                req.CitizenRoute, req.AdminRoute, req.IsActive,
                req.AdminSidebarOrder > 0 ? req.AdminSidebarOrder : nextOrder,
                req.ShowInAdminSidebar);
            await uow.SystemModules.AddAsync(existing, ct);
        }
        else
        {
            existing.Update(req.Label, req.Icon, req.Color, req.CitizenRoute, req.AdminRoute,
                req.IsActive, req.AdminSidebarOrder, req.ShowInAdminSidebar);
            uow.SystemModules.Update(existing);
        }
        await uow.SaveChangesAsync(ct);
        return ToDto(existing);
    }

    public async Task SetModuleActiveAsync(string key, bool isActive, CancellationToken ct)
    {
        log.LogStep(nameof(SetModuleActiveAsync), new { key, isActive });
        var module = await uow.SystemModules.GetByKeyAsync(key, ct)
            ?? throw new NotFoundException("Modül bulunamadı.", "MODULE_NOT_FOUND");
        module.SetActive(isActive);
        uow.SystemModules.Update(module);
        await uow.SaveChangesAsync(ct);
    }

    public async Task ReorderSystemModulesAsync(ReorderSystemModulesRequest req, CancellationToken ct)
    {
        var all = await uow.SystemModules.GetAllOrderedAsync(ct);
        var map = all.ToDictionary(x => x.Id.ToString());
        for (var i = 0; i < req.OrderedIds.Count; i++)
        {
            if (map.TryGetValue(req.OrderedIds[i], out var m))
                m.SetAdminOrder(i);
        }
        await uow.SaveChangesAsync(ct);
    }


    public async Task<List<MenuSectionDto>> GetSectionsWithItemsAsync(CancellationToken ct)
    {
        var sections = await uow.MenuSections.GetWithItemsAsync(ct);
        return sections.Select(ToDto).ToList();
    }

    public async Task<List<MenuSectionDto>> GetPublicMenuAsync(CancellationToken ct)
    {
        var sections = await uow.MenuSections.GetVisibleWithItemsAsync(ct);
        var activeModuleKeys = (await uow.SystemModules.GetAllOrderedAsync(ct))
            .Where(m => m.IsActive)
            .Select(m => m.Key)
            .ToHashSet();

        return sections.Select(s => new MenuSectionDto(
            s.Id.ToString(), s.Key, s.Title, s.Icon, s.IsVisible, s.ShowInSidebar, s.ShowInMobile, s.Order,
            s.Items
                .Where(i => i.ModuleKey is null || activeModuleKeys.Contains(i.ModuleKey))
                .Select(ToItemDto)
                .ToList()
        )).ToList();
    }

    public async Task<MenuSectionDto> CreateSectionAsync(CreateMenuSectionRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateSectionAsync), new { req.Key });
        if (await uow.MenuSections.GetByKeyAsync(req.Key, ct) is not null)
            throw new ConflictException("Bu anahtar zaten kullanılıyor.", "SECTION_KEY_EXISTS");

        var nextOrder = await uow.MenuSections.MaxOrderAsync(ct) + 1;
        var section = MenuSection.Create(req.Key, req.Title, req.Icon, req.IsVisible, req.ShowInSidebar, req.ShowInMobile, nextOrder);
        await uow.MenuSections.AddAsync(section, ct);
        await uow.SaveChangesAsync(ct);
        return ToDto(section);
    }

    public async Task<MenuSectionDto> UpdateSectionAsync(Guid id, UpdateMenuSectionRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateSectionAsync), new { id });
        var section = await uow.MenuSections.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bölüm bulunamadı.", "SECTION_NOT_FOUND");
        section.Update(req.Title, req.Icon, req.IsVisible, req.ShowInSidebar, req.ShowInMobile);
        uow.MenuSections.Update(section);
        await uow.SaveChangesAsync(ct);
        return ToDto(section);
    }

    public async Task DeleteSectionAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteSectionAsync), new { id });
        var section = await uow.MenuSections.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bölüm bulunamadı.", "SECTION_NOT_FOUND");
        uow.MenuSections.Delete(section);
        await uow.SaveChangesAsync(ct);
    }

    public async Task ReorderSectionsAsync(ReorderMenuSectionsRequest req, CancellationToken ct)
    {
        var all = await uow.MenuSections.GetAllOrderedAsync(ct);
        var map = all.ToDictionary(x => x.Id.ToString());
        for (var i = 0; i < req.OrderedIds.Count; i++)
        {
            if (map.TryGetValue(req.OrderedIds[i], out var s))
                s.SetOrder(i);
        }
        await uow.SaveChangesAsync(ct);
    }


    public async Task<MenuItemDto> CreateItemAsync(CreateMenuItemRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateItemAsync), new { req.Title });
        var sectionId = Guid.Parse(req.SectionId);
        var nextOrder = await uow.MenuItems.MaxOrderInSectionAsync(sectionId, ct) + 1;
        var item = MenuItem.Create(
            sectionId, req.ModuleKey,
            req.Title, req.Icon, req.IconType, req.Color,
            req.LinkType, req.LinkTarget, req.MobileLinkTarget,
            req.ShowInSidebar, req.ShowInMobile,
            req.IsPopular, req.IsVisible, req.RequiresAuth,
            req.BadgeText, req.BadgeTone, nextOrder);
        await uow.MenuItems.AddAsync(item, ct);
        await uow.SaveChangesAsync(ct);
        return ToItemDto(item);
    }

    public async Task<MenuItemDto> UpdateItemAsync(Guid id, UpdateMenuItemRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateItemAsync), new { id });
        var item = await uow.MenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.", "MENU_ITEM_NOT_FOUND");
        item.Update(
            Guid.Parse(req.SectionId), req.ModuleKey,
            req.Title, req.Icon, req.IconType, req.Color,
            req.LinkType, req.LinkTarget, req.MobileLinkTarget,
            req.ShowInSidebar, req.ShowInMobile,
            req.IsPopular, req.IsVisible, req.RequiresAuth,
            req.BadgeText, req.BadgeTone);
        uow.MenuItems.Update(item);
        await uow.SaveChangesAsync(ct);
        return ToItemDto(item);
    }

    public async Task DeleteItemAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteItemAsync), new { id });
        var item = await uow.MenuItems.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Menü öğesi bulunamadı.", "MENU_ITEM_NOT_FOUND");
        uow.MenuItems.Delete(item);
        await uow.SaveChangesAsync(ct);
    }

    public async Task ReorderItemsAsync(Guid sectionId, ReorderMenuItemsRequest req, CancellationToken ct)
    {
        var items = await uow.MenuItems.GetBySectionAsync(sectionId, ct);
        var map = items.ToDictionary(x => x.Id.ToString());
        for (var i = 0; i < req.OrderedIds.Count; i++)
        {
            if (map.TryGetValue(req.OrderedIds[i], out var item))
                item.SetOrder(i);
        }
        await uow.SaveChangesAsync(ct);
    }


    private static SystemModuleDto ToDto(SystemModule m) => new(
        m.Id.ToString(), m.Key, m.Label, m.Icon, m.Color,
        m.CitizenRoute, m.AdminRoute, m.IsActive,
        m.AdminSidebarOrder, m.ShowInAdminSidebar);

    private static MenuSectionDto ToDto(MenuSection s) => new(
        s.Id.ToString(), s.Key, s.Title, s.Icon, s.IsVisible, s.ShowInSidebar, s.ShowInMobile, s.Order,
        s.Items.Select(ToItemDto).ToList());

    private static MenuItemDto ToItemDto(MenuItem i) => new(
        i.Id.ToString(), i.SectionId.ToString(), i.ModuleKey,
        i.Title, i.Icon, (int)i.IconType, i.Color,
        (int)i.LinkType, i.LinkTarget, i.MobileLinkTarget,
        i.ShowInSidebar, i.ShowInMobile,
        i.IsPopular, i.IsVisible, i.RequiresAuth,
        i.BadgeText, i.BadgeTone, i.Order);
}
