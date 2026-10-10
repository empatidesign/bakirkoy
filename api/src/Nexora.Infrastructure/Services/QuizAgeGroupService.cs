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

public class QuizAgeGroupService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : IQuizAgeGroupService
{
    public async Task<PagedResult<QuizAgeGroupDto>> GetPagedAsync(QuizAgeGroupListParams p, CancellationToken ct)
    {
        var paged = await uow.QuizAgeGroups.GetPagedAsync(p, ct);
        var counts = await uow.Quizzes.CountByAgeGroupsAsync(paged.Items.Select(g => g.Id).ToList(), ct);

        return new PagedResult<QuizAgeGroupDto>
        {
            Items = paged.Items.Select(g => ToDto(g, counts.GetValueOrDefault(g.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<QuizAgeGroupOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.QuizAgeGroups.GetActiveAsync(ct);
        return items.Select(g => new QuizAgeGroupOptionDto(g.Id, g.Name, g.MinAge, g.MaxAge)).ToList();
    }

    public async Task<QuizAgeGroupSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var total = await uow.QuizAgeGroups.CountAsync(null, ct);
        var active = await uow.QuizAgeGroups.CountAsync(g => g.IsActive, ct);
        return new QuizAgeGroupSummaryDto(total, active, total - active);
    }

    public async Task<QuizAgeGroupDto> CreateAsync(CreateQuizAgeGroupRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.QuizAgeGroups.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu yaş grubu adı zaten kullanılıyor.", "DUPLICATE_QUIZ_AGE_GROUP");

        var group = QuizAgeGroup.Create(req.Name, req.MinAge, req.MaxAge, req.SortOrder);

        await uow.QuizAgeGroups.AddAsync(group, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "QuizAgeGroup",
            EntityId = group.Id,
            Module = "Quiz",
            Description = $"Yarışma yaş grubu oluşturuldu: {group.Name} ({group.MinAge}-{group.MaxAge})",
        }, ct);

        return ToDto(group, 0);
    }

    public async Task<QuizAgeGroupDto> UpdateAsync(Guid id, UpdateQuizAgeGroupRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var group = await uow.QuizAgeGroups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yaş grubu bulunamadı.", "QUIZ_AGE_GROUP_NOT_FOUND");

        if (await uow.QuizAgeGroups.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu yaş grubu adı zaten kullanılıyor.", "DUPLICATE_QUIZ_AGE_GROUP");

        var oldValues = JsonSerializer.Serialize(new { group.Name, group.MinAge, group.MaxAge, group.SortOrder });

        group.Update(req.Name, req.MinAge, req.MaxAge, req.SortOrder);

        uow.QuizAgeGroups.Update(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "QuizAgeGroup",
            EntityId = group.Id,
            Module = "Quiz",
            Description = $"Yarışma yaş grubu güncellendi: {group.Name} ({group.MinAge}-{group.MaxAge})",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new { group.Name, group.MinAge, group.MaxAge, group.SortOrder }),
        }, ct);

        return ToDto(group, await uow.Quizzes.CountByAgeGroupAsync(id, ct));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        var group = await uow.QuizAgeGroups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yaş grubu bulunamadı.", "QUIZ_AGE_GROUP_NOT_FOUND");

        if (await uow.Quizzes.CountByAgeGroupAsync(id, ct) > 0)
            throw new ConflictException("Bu yaş grubuna tanımlı yarışma bulunduğu için silinemez.", "QUIZ_AGE_GROUP_IN_USE");

        uow.QuizAgeGroups.Delete(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "QuizAgeGroup",
            EntityId = group.Id,
            Module = "Quiz",
            Description = $"Yarışma yaş grubu silindi: {group.Name} ({group.MinAge}-{group.MaxAge})",
        }, ct);
    }

    public async Task<QuizAgeGroupDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var group = await uow.QuizAgeGroups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yaş grubu bulunamadı.", "QUIZ_AGE_GROUP_NOT_FOUND");

        var count = await uow.Quizzes.CountByAgeGroupAsync(id, ct);

        if (group.IsActive)
        {
            if (count > 0)
                throw new ConflictException("Bu yaş grubuna tanımlı yarışma bulunduğu için pasife alınamaz.", "QUIZ_AGE_GROUP_IN_USE");
            group.Deactivate();
        }
        else
        {
            group.Activate();
        }

        uow.QuizAgeGroups.Update(group);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "QuizAgeGroup",
            EntityId = group.Id,
            Module = "Quiz",
            Description = $"Yarışma yaş grubu {(group.IsActive ? "aktif edildi" : "pasife alındı")}: {group.Name}",
        }, ct);

        return ToDto(group, count);
    }

    private static QuizAgeGroupDto ToDto(QuizAgeGroup g, int quizCount)
        => new(g.Id, g.Name, g.MinAge, g.MaxAge, g.SortOrder, quizCount, g.IsActive);
}
