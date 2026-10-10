using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Quizzes;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class QuizCategoryService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : IQuizCategoryService
{
    public async Task<PagedResult<QuizCategoryDto>> GetPagedAsync(QuizCategoryListParams p, CancellationToken ct)
    {
        var paged = await uow.QuizCategories.GetPagedAsync(p, ct);
        var counts = await uow.Quizzes.CountByCategoriesAsync(paged.Items.Select(c => c.Id).ToList(), ct);

        var parentIds = paged.Items.Where(c => c.ParentId.HasValue).Select(c => c.ParentId!.Value).Distinct().ToList();
        var parents = parentIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.QuizCategories.GetByIdsAsync(parentIds, ct)).ToDictionary(c => c.Id, c => c.Name);

        return new PagedResult<QuizCategoryDto>
        {
            Items = paged.Items.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id),
                c.ParentId.HasValue ? parents.GetValueOrDefault(c.ParentId.Value) : null)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<QuizCategoryOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.QuizCategories.GetActiveAsync(ct);
        return items.Select(c => new QuizCategoryOptionDto(c.Id, c.Name, c.ParentId)).ToList();
    }

    public async Task<QuizCategorySummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var total = await uow.QuizCategories.CountAsync(null, ct);
        var active = await uow.QuizCategories.CountAsync(c => c.IsActive, ct);
        return new QuizCategorySummaryDto(total, active, total - active);
    }

    public async Task<QuizCategoryDto> CreateAsync(CreateQuizCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.QuizCategories.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_QUIZ_CATEGORY");

        if (req.ParentId.HasValue && await uow.QuizCategories.GetByIdAsync(req.ParentId.Value, ct) is null)
            throw new NotFoundException("Üst kategori bulunamadı.", "QUIZ_PARENT_CATEGORY_NOT_FOUND");

        var category = QuizCategory.Create(req.Name, req.Description, req.Color, req.ParentId);

        await uow.QuizCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "QuizCategory",
            EntityId = category.Id,
            Module = "Quiz",
            Description = $"Yarışma kategorisi oluşturuldu: {category.Name}",
        }, ct);

        var parentName = req.ParentId.HasValue ? (await uow.QuizCategories.GetByIdAsync(req.ParentId.Value, ct))?.Name : null;
        return ToDto(category, 0, parentName);
    }

    public async Task<QuizCategoryDto> UpdateAsync(Guid id, UpdateQuizCategoryRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var category = await uow.QuizCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "QUIZ_CATEGORY_NOT_FOUND");

        if (await uow.QuizCategories.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu kategori adı zaten kullanılıyor.", "DUPLICATE_QUIZ_CATEGORY");

        if (req.ParentId == id)
            throw new ConflictException("Bir kategori kendi üst kategorisi olamaz.", "QUIZ_CATEGORY_SELF_PARENT");

        if (req.ParentId.HasValue && await uow.QuizCategories.GetByIdAsync(req.ParentId.Value, ct) is null)
            throw new NotFoundException("Üst kategori bulunamadı.", "QUIZ_PARENT_CATEGORY_NOT_FOUND");

        var oldValues = JsonSerializer.Serialize(new { category.Name, category.Description, category.Color, category.ParentId });

        category.Update(req.Name, req.Description, req.Color, req.ParentId);

        uow.QuizCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "QuizCategory",
            EntityId = category.Id,
            Module = "Quiz",
            Description = $"Yarışma kategorisi güncellendi: {category.Name}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new { category.Name, category.Description, category.Color, category.ParentId }),
        }, ct);

        var parentName = category.ParentId.HasValue ? (await uow.QuizCategories.GetByIdAsync(category.ParentId.Value, ct))?.Name : null;
        return ToDto(category, await uow.Quizzes.CountByCategoryAsync(id, ct), parentName);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        var category = await uow.QuizCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "QUIZ_CATEGORY_NOT_FOUND");

        if (await uow.Quizzes.CountByCategoryAsync(id, ct) > 0)
            throw new ConflictException("Bu kategoriye tanımlı yarışma bulunduğu için silinemez.", "QUIZ_CATEGORY_IN_USE");

        if (await uow.QuizCategories.HasChildrenAsync(id, ct))
            throw new ConflictException("Alt kategorisi olan bir kategori silinemez.", "QUIZ_CATEGORY_HAS_CHILDREN");

        uow.QuizCategories.Delete(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "QuizCategory",
            EntityId = category.Id,
            Module = "Quiz",
            Description = $"Yarışma kategorisi silindi: {category.Name}",
        }, ct);
    }

    public async Task<QuizCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var category = await uow.QuizCategories.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kategori bulunamadı.", "QUIZ_CATEGORY_NOT_FOUND");

        var count = await uow.Quizzes.CountByCategoryAsync(id, ct);

        if (category.IsActive)
        {
            if (count > 0)
                throw new ConflictException("Bu kategoriye tanımlı yarışma bulunduğu için pasife alınamaz.", "QUIZ_CATEGORY_IN_USE");
            category.Deactivate();
        }
        else
        {
            category.Activate();
        }

        uow.QuizCategories.Update(category);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "QuizCategory",
            EntityId = category.Id,
            Module = "Quiz",
            Description = $"Yarışma kategorisi {(category.IsActive ? "aktif edildi" : "pasife alındı")}: {category.Name}",
        }, ct);

        var parentName = category.ParentId.HasValue ? (await uow.QuizCategories.GetByIdAsync(category.ParentId.Value, ct))?.Name : null;
        return ToDto(category, count, parentName);
    }

    private static QuizCategoryDto ToDto(QuizCategory c, int quizCount, string? parentName)
        => new(c.Id, c.Name, c.Description, c.Color, c.ParentId, parentName, quizCount, c.IsActive);
}
