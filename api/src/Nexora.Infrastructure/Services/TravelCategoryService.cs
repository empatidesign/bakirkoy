using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class TravelCategoryService(IUnitOfWork uow, IAuditService audit, IActivityLogger log) : ITravelCategoryService
{
    public async Task<PagedResult<TravelCategoryDto>> GetPagedAsync(TravelCategoryListParams p, CancellationToken ct)
    {
        var paged = await uow.TravelCategories.GetPagedAsync(p, ct);
        var stats = await uow.Travels.GetStatsByCategoriesAsync(paged.Items.Select(c => c.Id).ToList(), ct);

        return new PagedResult<TravelCategoryDto>
        {
            Items = paged.Items.Select(c => { var s = stats.GetValueOrDefault(c.Id); return ToDto(c, s.Count, s.Capacity, s.Registered); }).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<TravelCategoryOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.TravelCategories.GetActiveAsync(ct);
        return items.Select(c => new TravelCategoryOptionDto(c.Id, c.Name, c.Color)).ToList();
    }

    public async Task<TravelCategoryDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var c = await uow.TravelCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");
        return ToDto(c, await uow.Travels.CountByCategoryAsync(id, ct));
    }

    public async Task<TravelCategoryDto> CreateAsync(TravelCategoryFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.TravelCategories.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_TRAVEL_CATEGORY");

        var category = TravelCategory.Create(req.Name, req.Description, req.Color);
        if (!req.IsActive) category.Deactivate();

        await uow.TravelCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "TravelCategory",
            EntityId = category.Id,
            Module = "Travels",
            Description = $"Gezi kategorisi oluşturuldu: {category.Name}",
        }, ct);

        return ToDto(category, 0);
    }

    public async Task<TravelCategoryDto> UpdateAsync(Guid id, TravelCategoryFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var category = await uow.TravelCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");

        if (await uow.TravelCategories.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_TRAVEL_CATEGORY");

        var oldValues = System.Text.Json.JsonSerializer.Serialize(new { category.Name, category.Description, category.Color, category.IsActive });
        category.Update(req.Name, req.Description, req.Color);
        if (req.IsActive) category.Activate(); else category.Deactivate();

        uow.TravelCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "TravelCategory",
            EntityId = category.Id,
            Module = "Travels",
            Description = $"Gezi kategorisi güncellendi: {category.Name}",
            OldValues = oldValues,
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { category.Name, category.Description, category.Color, category.IsActive }),
        }, ct);

        return ToDto(category, await uow.Travels.CountByCategoryAsync(id, ct));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.TravelCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");

        if (await uow.Travels.CountByCategoryAsync(id, ct) > 0)
            throw new ConflictException("Bu kategoriye tanımlı gezi bulunduğu için silinemez.", "TRAVEL_CATEGORY_IN_USE");

        uow.TravelCategories.Delete(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "TravelCategory",
            EntityId = category.Id,
            Module = "Travels",
            Description = $"Gezi kategorisi silindi: {category.Name}",
        }, ct);
    }

    public async Task<TravelCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.TravelCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "TRAVEL_CATEGORY_NOT_FOUND");

        var count = await uow.Travels.CountByCategoryAsync(id, ct);

        if (category.IsActive)
        {
            if (count > 0)
                throw new ConflictException("Bu kategoriye tanımlı gezi bulunduğu için pasife alınamaz.", "TRAVEL_CATEGORY_IN_USE");
            category.Deactivate();
        }
        else
        {
            category.Activate();
        }

        uow.TravelCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "TravelCategory",
            EntityId = category.Id,
            Module = "Travels",
            Description = $"Gezi kategorisi durumu değişti: {category.Name} -> {(category.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return ToDto(category, count);
    }

    private static TravelCategoryDto ToDto(TravelCategory c, int travelCount, int totalCapacity = 0, int totalRegistered = 0)
        => new(c.Id, c.Name, c.Description, c.Color, travelCount, totalCapacity, totalRegistered, c.IsActive, c.CreatedAt, c.UpdatedAt);
}
