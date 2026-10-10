using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ServiceCategoryService(IUnitOfWork uow, IAuditService audit, IActivityLogger log) : IServiceCategoryService
{
    private static readonly string[] Palette =
        ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#db2777", "#ca8a04"];

    public async Task<PagedResult<ServiceCategoryDto>> GetPagedAsync(ServiceCategoryListParams p, CancellationToken ct)
    {
        var paged = await uow.ServiceCategories.GetPagedAsync(p, ct);
        var counts = await uow.ServiceCategories.CountCompaniesByCategoriesAsync(paged.Items.Select(c => c.Id).ToList(), ct);

        return new PagedResult<ServiceCategoryDto>
        {
            Items = paged.Items.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<ServiceCategoryRefDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.ServiceCategories.GetActiveAsync(ct);
        return items.Select(ToRef).ToList();
    }

    public async Task<ServiceCategorySummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var total = await uow.ServiceCategories.CountAsync(null, ct);
        var active = await uow.ServiceCategories.CountAsync(c => c.IsActive, ct);
        return new ServiceCategorySummaryDto(total, active, total - active);
    }

    public async Task<ServiceCategoryDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.ServiceCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "SERVICE_CATEGORY_NOT_FOUND");
        return ToDto(category, await uow.ServiceCategories.CountCompaniesAsync(id, ct));
    }

    public async Task<ServiceCategoryDto> CreateAsync(CreateServiceCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.ServiceCategories.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_SERVICE_CATEGORY");

        var category = ServiceCategory.Create(req.Name, req.Description, req.Color);
        await uow.ServiceCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "ServiceCategory",
            EntityId = category.Id,
            Module = "ServiceCategories",
            Description = $"Hizmet kategorisi oluşturuldu: {category.Name}",
        }, ct);

        return ToDto(category, 0);
    }

    public async Task<ServiceCategoryDto> UpdateAsync(Guid id, UpdateServiceCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var category = await uow.ServiceCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "SERVICE_CATEGORY_NOT_FOUND");

        if (await uow.ServiceCategories.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_SERVICE_CATEGORY");

        var oldValues = System.Text.Json.JsonSerializer.Serialize(new { category.Name, category.Description, category.Color });
        category.Update(req.Name, req.Description, req.Color);
        uow.ServiceCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "ServiceCategory",
            EntityId = category.Id,
            Module = "ServiceCategories",
            Description = $"Hizmet kategorisi güncellendi: {category.Name}",
            OldValues = oldValues,
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { category.Name, category.Description, category.Color }),
        }, ct);

        return ToDto(category, await uow.ServiceCategories.CountCompaniesAsync(id, ct));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        var category = await uow.ServiceCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "SERVICE_CATEGORY_NOT_FOUND");

        if (await uow.ServiceCategories.CountCompaniesAsync(id, ct) > 0)
            throw new ConflictException("Bu kategoriye atanmış firma bulunduğu için silinemez.", "SERVICE_CATEGORY_IN_USE");

        uow.ServiceCategories.Delete(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "ServiceCategory",
            EntityId = category.Id,
            Module = "ServiceCategories",
            Description = $"Hizmet kategorisi silindi: {category.Name}",
        }, ct);
    }

    public async Task<ServiceCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.ServiceCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "SERVICE_CATEGORY_NOT_FOUND");

        var count = await uow.ServiceCategories.CountCompaniesAsync(id, ct);

        if (category.IsActive)
        {
            if (count > 0)
                throw new ConflictException("Bu kategoriye atanmış firma bulunduğu için pasife alınamaz.", "SERVICE_CATEGORY_IN_USE");
            category.Deactivate();
        }
        else
        {
            category.Activate();
        }

        uow.ServiceCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "ServiceCategory",
            EntityId = category.Id,
            Module = "ServiceCategories",
            Description = $"Hizmet kategorisi durumu değişti: {category.Name} -> {(category.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return ToDto(category, count);
    }

    public async Task<ServiceCategoryRefDto> CreateOrGetByNameAsync(string name, CancellationToken ct)
    {
        var trimmed = name.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new ConflictException("Kategori adı zorunludur.", "SERVICE_CATEGORY_NAME_REQUIRED");

        var existing = await uow.ServiceCategories.GetByNameAsync(trimmed, ct);
        if (existing is not null)
        {
            if (!existing.IsActive) existing.Activate();
            uow.ServiceCategories.Update(existing);
            await uow.SaveChangesAsync(ct);
            return ToRef(existing);
        }

        var total = await uow.ServiceCategories.CountAsync(null, ct);
        var color = Palette[total % Palette.Length];
        var category = ServiceCategory.Create(trimmed, null, color);
        await uow.ServiceCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);
        return ToRef(category);
    }

    private static ServiceCategoryDto ToDto(ServiceCategory c, int companyCount)
        => new(c.Id, c.Name, c.Description, c.Color, companyCount, c.IsActive);

    private static ServiceCategoryRefDto ToRef(ServiceCategory c)
        => new(c.Id, c.Name, c.Color);
}
