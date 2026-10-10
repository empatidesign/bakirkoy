using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilityBranchService(IUnitOfWork uow, ICurrentUser current, IAuditService audit) : IFacilityBranchService
{
    public async Task<PagedResult<FacilityBranchDto>> GetPagedAsync(string module, FacilityBranchListParams p, CancellationToken ct)
    {
        var paged = await uow.FacilityBranches.GetPagedAsync(module, p, ct);
        var ids = paged.Items.Select(b => b.Id).ToList();
        Dictionary<Guid, int> groupCounts = ids.Count > 0
            ? await uow.FacilityGroups.CountActiveByBranchesAsync(ids, ct)
            : new();
        Dictionary<Guid, int> sessionCounts = ids.Count > 0
            ? await uow.FacilitySessions.CountActiveByBranchesAsync(ids, ct)
            : new();
        Dictionary<Guid, int> applicationCounts = ids.Count > 0
            ? await uow.FacilityApplications.CountByBranchesAsync(ids, ct)
            : new();

        return new PagedResult<FacilityBranchDto>
        {
            Items = paged.Items.Select(b => ToDto(b, groupCounts.GetValueOrDefault(b.Id)) with
            {
                SessionCount = sessionCounts.GetValueOrDefault(b.Id),
                ApplicationCount = applicationCounts.GetValueOrDefault(b.Id),
            }).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<FacilityBranchOptionDto>> GetOptionsAsync(string module, CancellationToken ct)
    {
        var items = await uow.FacilityBranches.GetActiveByModuleAsync(module, ct);
        return items.Select(b => new FacilityBranchOptionDto(b.Id, b.Name, b.PeriodMonths, b.AbsenceLimit, b.ConsecutiveAbsenceLimit, b.Category)).ToList();
    }

    public async Task<FacilityBranchDto> CreateAsync(string module, CreateFacilityBranchRequest req, CancellationToken ct)
    {
        if (await uow.FacilityBranches.ExistsByNameAsync(module, req.Name, null, ct))
            throw new ConflictException("Bu ad zaten kullanılıyor.", "DUPLICATE_BRANCH");

        var branch = FacilityBranch.Create(
            new FacilityBranchData(module, req.Name, req.Description, req.PeriodMonths, req.AbsenceLimit, req.ConsecutiveAbsenceLimit, req.IsActive, req.Category ?? ""),
            current.Name);

        await uow.FacilityBranches.AddAsync(branch, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilityBranch",
            EntityId = branch.Id,
            Module = module,
            Description = $"Program oluşturuldu: {branch.Name}",
        }, ct);

        return ToDto(branch, 0);
    }

    public async Task<FacilityBranchDto> UpdateAsync(string module, Guid id, UpdateFacilityBranchRequest req, CancellationToken ct)
    {
        var branch = await GetOwnedAsync(module, id, ct);
        if (await uow.FacilityBranches.ExistsByNameAsync(module, req.Name, id, ct))
            throw new ConflictException("Bu ad zaten kullanılıyor.", "DUPLICATE_BRANCH");

        var oldName = branch.Name;
        branch.Update(
            new FacilityBranchData(module, req.Name, req.Description, req.PeriodMonths, req.AbsenceLimit, req.ConsecutiveAbsenceLimit, req.IsActive, req.Category ?? ""),
            current.Name);

        uow.FacilityBranches.Update(branch);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "FacilityBranch",
            EntityId = branch.Id,
            Module = module,
            Description = $"Program güncellendi: {oldName} -> {branch.Name}",
        }, ct);

        var groupCount = await uow.FacilityGroups.CountByBranchAsync(id, ct);
        return ToDto(branch, groupCount);
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var branch = await GetOwnedAsync(module, id, ct);
        var groupCount = await uow.FacilityGroups.CountByBranchAsync(id, ct);
        if (groupCount > 0)
            throw new ConflictException($"Bu programa bağlı {groupCount} grup olduğu için silinemez. Önce grupları kaldırın.", "BRANCH_IN_USE");

        branch.MarkDeleted(current.Name);
        uow.FacilityBranches.Update(branch);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "FacilityBranch",
            EntityId = branch.Id,
            Module = module,
            Description = $"Program silindi: {branch.Name}",
        }, ct);
    }

    public async Task<FacilityBranchDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct)
    {
        var branch = await GetOwnedAsync(module, id, ct);
        if (branch.IsActive) branch.Deactivate();
        else branch.Activate();

        uow.FacilityBranches.Update(branch);
        await uow.SaveChangesAsync(ct);

        var groupCount = await uow.FacilityGroups.CountByBranchAsync(id, ct);
        return ToDto(branch, groupCount);
    }

    public async Task<PagedResult<FacilityBranchDto>> GetTrashAsync(string module, FacilityBranchListParams p, CancellationToken ct)
    {
        var paged = await uow.FacilityBranches.GetTrashAsync(module, p, ct);
        return new PagedResult<FacilityBranchDto>
        {
            Items = paged.Items.Select(b => ToDto(b, 0)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<FacilityBranchDto> RestoreAsync(string module, Guid id, CancellationToken ct)
    {
        var branch = await uow.FacilityBranches.GetAnyByIdAsync(id, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");

        if (!branch.IsDeleted)
            throw new ConflictException("Program zaten arşivde değil.", "BRANCH_NOT_DELETED");

        branch.Restore();
        uow.FacilityBranches.Update(branch);
        await uow.SaveChangesAsync(ct);

        var groupCount = await uow.FacilityGroups.CountByBranchAsync(id, ct);
        return ToDto(branch, groupCount);
    }

    public async Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var branch = await uow.FacilityBranches.GetAnyByIdAsync(id, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");

        if (!branch.IsDeleted)
            throw new ConflictException("Kalıcı silmeden önce program çöp kutusunda olmalıdır.", "BRANCH_NOT_IN_TRASH");

        var groupCount = await uow.FacilityGroups.CountByBranchAsync(id, ct);
        if (groupCount > 0)
            throw new ConflictException($"Bu programa bağlı {groupCount} grup olduğu için kalıcı olarak silinemez.", "BRANCH_IN_USE");

        uow.FacilityBranches.HardRemove(branch);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "FacilityBranch",
            EntityId = branch.Id,
            Module = module,
            Description = $"Program kalıcı olarak silindi: {branch.Name}",
            Level = AuditLogLevel.Warning,
        }, ct);
    }

    public async Task<int> BulkUpdateCategoryAsync(string module, IReadOnlyList<Guid> ids, string? category, CancellationToken ct)
    {
        if (ids is null || ids.Count == 0) return 0;
        var branches = await uow.FacilityBranches.FindAsync(x => x.Module == module && ids.Contains(x.Id), ct);
        if (branches.Count == 0) return 0;

        var trimmedCat = (category ?? "").Trim();
        foreach (var b in branches)
        {
            b.Update(
                new FacilityBranchData(module, b.Name, b.Description, b.PeriodMonths, b.AbsenceLimit, b.ConsecutiveAbsenceLimit, b.IsActive, trimmedCat),
                current.Name);
        }
        uow.FacilityBranches.UpdateRange(branches);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "FacilityBranch",
            EntityId = branches[0].Id,
            Module = module,
            Description = $"{branches.Count} programın kategorisi güncellendi: '{trimmedCat}'",
        }, ct);

        return branches.Count;
    }

    private async Task<FacilityBranch> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var branch = await uow.FacilityBranches.GetByIdAsync(id, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");
        return branch;
    }

    private static FacilityBranchDto ToDto(FacilityBranch b, int groupCount)
        => new(b.Id, b.Module, b.Name, b.Description, b.PeriodMonths, b.AbsenceLimit, b.ConsecutiveAbsenceLimit, groupCount, b.IsActive, b.CreatedAt, b.DeletedAt, b.DeletedBy, 0, 0, b.Category);
}
