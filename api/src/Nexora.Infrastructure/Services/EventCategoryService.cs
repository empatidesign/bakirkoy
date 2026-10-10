using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class EventCategoryService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : IEventCategoryService
{
    public async Task<PagedResult<EventCategoryDto>> GetPagedAsync(EventCategoryListParams p, CancellationToken ct)
    {
        var paged = await uow.EventCategories.GetPagedAsync(p, ct);
        var counts = await uow.Events.CountByCategoriesAsync(paged.Items.Select(c => c.Id).ToList(), ct);

        return new PagedResult<EventCategoryDto>
        {
            Items = paged.Items.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<EventCategoryOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.EventCategories.GetActiveAsync(ct);
        return items.Select(c => new EventCategoryOptionDto(c.Id, c.Name, c.DefaultPoints)).ToList();
    }

    public async Task<EventCategorySummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var total = await uow.EventCategories.CountAsync(null, ct);
        var active = await uow.EventCategories.CountAsync(c => c.IsActive, ct);
        return new EventCategorySummaryDto(total, active, total - active);
    }

    public async Task<EventCategoryDto> CreateAsync(CreateEventCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.EventCategories.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_EVENT_CATEGORY");

        var category = EventCategory.Create(req.Name, req.Description, req.Color, req.DefaultPoints);

        await uow.EventCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "EventCategory",
            EntityId = category.Id,
            Module = "Events",
            Description = $"Etkinlik kategorisi oluşturuldu: {category.Name}",
        }, ct);

        return ToDto(category, 0);
    }

    public async Task<BulkCreateEventCategoryResult> BulkCreateAsync(BulkCreateEventCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(BulkCreateAsync), new { Count = req.Items.Count });

        var results = new List<BulkCreateEventCategoryItemResult>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var created = new List<EventCategory>();

        for (var i = 0; i < req.Items.Count; i++)
        {
            var item = req.Items[i];
            var name = item.Name.Trim();

            if (!seen.Add(name))
            {
                results.Add(new(i, name, false, null, "Listede tekrar eden ad."));
                continue;
            }
            if (await uow.EventCategories.ExistsByNameAsync(name, null, ct))
            {
                results.Add(new(i, name, false, null, "Bu kategori adı zaten kullanılıyor."));
                continue;
            }

            var category = EventCategory.Create(name, item.Description, item.Color, item.DefaultPoints);
            await uow.EventCategories.AddAsync(category, ct);
            created.Add(category);
            results.Add(new(i, name, true, category.Id, null));
        }

        if (created.Count > 0)
        {
            await uow.SaveChangesAsync(ct);
            foreach (var c in created)
            {
                await audit.LogAsync(new AuditEntry
                {
                    Action = AuditAction.Create,
                    EntityType = "EventCategory",
                    EntityId = c.Id,
                    Module = "Events",
                    Description = $"Etkinlik kategorisi toplu eklendi: {c.Name}",
                }, ct);
            }
        }

        return new BulkCreateEventCategoryResult(results);
    }

    public async Task<EventCategoryDto> UpdateAsync(Guid id, UpdateEventCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var category = await uow.EventCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        if (await uow.EventCategories.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_EVENT_CATEGORY");

        var oldValues = JsonSerializer.Serialize(ToDto(category, await uow.Events.CountByCategoryAsync(id, ct)));

        category.Update(req.Name, req.Description, req.Color, req.DefaultPoints);

        uow.EventCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        var newDto = ToDto(category, await uow.Events.CountByCategoryAsync(id, ct));
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "EventCategory",
            EntityId = category.Id,
            Module = "Events",
            Description = $"Etkinlik kategorisi güncellendi: {category.Name}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(newDto),
        }, ct);

        return newDto;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        var category = await uow.EventCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        if (await uow.Events.CountByCategoryAsync(id, ct) > 0)
            throw new ConflictException("Bu kategoriye tanımlı etkinlik bulunduğu için silinemez.", "EVENT_CATEGORY_IN_USE");

        uow.EventCategories.Delete(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "EventCategory",
            EntityId = category.Id,
            Module = "Events",
            Description = $"Etkinlik kategorisi silindi: {category.Name}",
        }, ct);
    }

    public async Task<EventCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.EventCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        var count = await uow.Events.CountByCategoryAsync(id, ct);

        if (category.IsActive)
        {
            if (count > 0)
                throw new ConflictException("Bu kategoriye tanımlı etkinlik bulunduğu için pasife alınamaz.", "EVENT_CATEGORY_IN_USE");
            category.Deactivate();
        }
        else
        {
            category.Activate();
        }

        uow.EventCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "EventCategory",
            EntityId = category.Id,
            Module = "Events",
            Description = category.IsActive
                ? $"Etkinlik kategorisi aktifleştirildi: {category.Name}"
                : $"Etkinlik kategorisi pasifleştirildi: {category.Name}",
        }, ct);

        return ToDto(category, count);
    }

    public async Task<EventCategoryDto> RestoreAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(RestoreAsync), new { id });

        var category = await uow.EventCategories.GetAnyByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        if (!category.IsDeleted)
            throw new ConflictException("Kategori zaten arşivde değil.", "EVENT_CATEGORY_NOT_DELETED");

        if (await uow.EventCategories.ExistsByNameAsync(category.Name, id, ct))
            throw new ConflictException(
                "Bu kategori adı şu anda başka bir aktif kategori tarafından kullanılıyor; önce onu yeniden adlandırın.",
                "DUPLICATE_EVENT_CATEGORY");

        category.Restore();
        uow.EventCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Restore,
            EntityType = "EventCategory",
            EntityId = category.Id,
            Module = "Events",
            Description = $"Etkinlik kategorisi çöp kutusundan geri yüklendi: {category.Name}",
        }, ct);

        return ToDto(category, await uow.Events.CountByCategoryAsync(id, ct));
    }

    private static EventCategoryDto ToDto(EventCategory c, int eventCount)
        => new(c.Id, c.Name, c.Description, c.Color, c.DefaultPoints, eventCount, c.IsActive);
}
