using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibraryRuleService(IUnitOfWork uow, IAuditService audit, ICurrentUser currentUser, IUserScopeService userScope) : ILibraryRuleService
{
    private async Task EnsureWriteInScopeAsync(Guid? libraryId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is null) return;
        if (libraryId is null)
            throw new ForbiddenException("Genel kuralları yalnızca kapsam kısıtı olmayan yöneticiler değiştirebilir.", "GLOBAL_RULE_FORBIDDEN");
        if (!scopedRefIds.Contains(libraryId.Value))
            throw new NotFoundException("Kural bulunamadı.", "LIBRARY_RULE_NOT_FOUND");
    }

    public async Task<PagedResult<LibraryRuleDto>> GetPagedAsync(LibraryRuleListParams p, CancellationToken ct)
    {
        var paged = await uow.LibraryRules.GetPagedAsync(p, ct);
        return new PagedResult<LibraryRuleDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<LibraryRuleSummaryDto> GetSummaryAsync(Guid? libraryId, CancellationToken ct)
        => await uow.LibraryRules.GetSummaryAsync(libraryId, ct);

    public async Task<LibraryRuleDto> CreateAsync(LibraryRuleRequest req, CancellationToken ct)
    {
        var libraryId = Guid.TryParse(req.LibraryId, out var lid) ? lid : (Guid?)null;
        await EnsureWriteInScopeAsync(libraryId, ct);
        var rule = LibraryRule.Create(libraryId);
        rule.SetDetails(req.Category, req.Title, req.Description, req.Icon, req.Severity);

        await uow.LibraryRules.AddAsync(rule, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "LibraryRule",
            EntityId = rule.Id,
            Module = "Library",
            Description = $"Kıraathane kuralı eklendi: {rule.Title}",
        }, ct);

        return MapDto(rule);
    }

    public async Task<LibraryRuleDto> UpdateAsync(Guid id, LibraryRuleRequest req, CancellationToken ct)
    {
        var rule = await GetOrThrowAsync(id, ct);
        await EnsureWriteInScopeAsync(rule.LibraryId, ct);
        rule.SetDetails(req.Category, req.Title, req.Description, req.Icon, req.Severity);
        uow.LibraryRules.Update(rule);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "LibraryRule",
            EntityId = rule.Id,
            Module = "Library",
            Description = $"Kıraathane kuralı güncellendi: {rule.Title}",
        }, ct);

        return MapDto(rule);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var rule = await GetOrThrowAsync(id, ct);
        await EnsureWriteInScopeAsync(rule.LibraryId, ct);
        uow.LibraryRules.Delete(rule);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "LibraryRule",
            EntityId = rule.Id,
            Module = "Library",
            Description = $"Kıraathane kuralı silindi: {rule.Title}",
        }, ct);
    }

    public async Task<LibraryRuleDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var rule = await GetOrThrowAsync(id, ct);
        await EnsureWriteInScopeAsync(rule.LibraryId, ct);
        rule.SetStatus(!rule.IsActive);
        uow.LibraryRules.Update(rule);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "LibraryRule",
            EntityId = rule.Id,
            Module = "Library",
            Description = $"Kıraathane kuralı durumu değiştirildi: {rule.Title} → {(rule.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return MapDto(rule);
    }

    private async Task<LibraryRule> GetOrThrowAsync(Guid id, CancellationToken ct)
        => await uow.LibraryRules.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kural bulunamadı.", "LIBRARY_RULE_NOT_FOUND");

    private static LibraryRuleDto MapDto(LibraryRule r)
        => new(r.Id, r.Category, r.Title, r.Description, r.Icon, r.Severity, r.IsActive);
}
