using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilityInstructorService(IUnitOfWork uow, ICurrentUser current, IScopedStaffService scopedStaff, IAuditService audit) : IFacilityInstructorService
{
    private const string InstructorRoleTemplateKey = "egitmen";

    public async Task<PagedResult<FacilityInstructorDto>> GetPagedAsync(string module, FacilityInstructorListParams p, CancellationToken ct)
    {
        var paged = await uow.FacilityInstructors.GetPagedAsync(module, p, ct);
        var items = new List<FacilityInstructorDto>(paged.Items.Count);
        foreach (var instructor in paged.Items)
        {
            var groupCount = await uow.FacilityGroups.CountByInstructorAsync(instructor.Id, ct);
            items.Add(ToDto(instructor, groupCount));
        }
        return new PagedResult<FacilityInstructorDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<FacilityInstructorOptionDto>> GetOptionsAsync(string module, CancellationToken ct)
    {
        var items = await uow.FacilityInstructors.GetActiveByModuleAsync(module, ct);
        var options = items.Select(i => new FacilityInstructorOptionDto(i.Id, i.FullName, i.Specialty)).ToList();

        var role = await uow.Roles.GetByKeyAsync("tpl-egitmen", ct);
        if (role is null) return options;

        var linkedUserIds = (await uow.FacilityInstructors.FindAsync(i => i.Module == module && i.UserId != null, ct))
            .Select(i => i.UserId!.Value)
            .ToHashSet();
        var users = await uow.AdminUsers.FindAsync(u => u.RoleId == role.Id && u.IsActive, ct);
        options.AddRange(users
            .Where(u => !linkedUserIds.Contains(u.Id))
            .Select(u => new FacilityInstructorOptionDto(u.Id, u.FullName, null)));
        return options.OrderBy(o => o.FullName).ToList();
    }

    public async Task<FacilityInstructorDto> CreateAsync(string module, CreateFacilityInstructorRequest req, CancellationToken ct)
    {
        if (await uow.FacilityInstructors.ExistsByNameAsync(module, req.FullName, null, ct))
            throw new ConflictException("Bu adda bir eğitmen zaten var.", "DUPLICATE_INSTRUCTOR");

        var account = await scopedStaff.EnsureAccountAsync(new EnsureStaffAccountRequest(
            FullName: req.FullName,
            Tckn: req.Tckn,
            Phone: req.Phone,
            Email: req.Email!,
            RoleTemplateKey: InstructorRoleTemplateKey,
            DeliveryChannel: string.IsNullOrWhiteSpace(req.DeliveryChannel) ? "Email" : req.DeliveryChannel), ct);

        var instructor = FacilityInstructor.Create(
            new FacilityInstructorData(module, req.FullName, req.Tckn, req.Phone, req.Email, req.Specialty, req.IsActive),
            current.Name);
        instructor.LinkUser(account.AdminUserId);

        await uow.FacilityInstructors.AddAsync(instructor, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FacilityInstructor",
            EntityId = instructor.Id,
            Module = module,
            Description = $"Eğitmen oluşturuldu: {instructor.FullName}",
        }, ct);

        return ToDto(instructor, 0);
    }

    public async Task<FacilityInstructorDto> UpdateAsync(string module, Guid id, UpdateFacilityInstructorRequest req, CancellationToken ct)
    {
        var instructor = await GetOwnedAsync(module, id, ct);
        if (await uow.FacilityInstructors.ExistsByNameAsync(module, req.FullName, id, ct))
            throw new ConflictException("Bu adda bir eğitmen zaten var.", "DUPLICATE_INSTRUCTOR");

        var oldName = instructor.FullName;
        instructor.Update(new FacilityInstructorData(module, req.FullName, req.Tckn, req.Phone, req.Email, req.Specialty, req.IsActive), current.Name);
        uow.FacilityInstructors.Update(instructor);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "FacilityInstructor",
            EntityId = instructor.Id,
            Module = module,
            Description = $"Eğitmen güncellendi: {oldName} -> {instructor.FullName}",
        }, ct);

        var groupCount = await uow.FacilityGroups.CountByInstructorAsync(id, ct);
        return ToDto(instructor, groupCount);
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var instructor = await GetOwnedAsync(module, id, ct);
        var groupCount = await uow.FacilityGroups.CountByInstructorAsync(id, ct);
        if (groupCount > 0)
            throw new ConflictException($"Bu eğitmen {groupCount} gruba atanmış olduğu için silinemez. Önce grupların eğitmenini değiştirin.", "INSTRUCTOR_IN_USE");

        instructor.MarkDeleted(current.Name);
        uow.FacilityInstructors.Update(instructor);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "FacilityInstructor",
            EntityId = instructor.Id,
            Module = module,
            Description = $"Eğitmen silindi: {instructor.FullName}",
        }, ct);
    }

    public async Task<FacilityInstructorDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct)
    {
        var instructor = await GetOwnedAsync(module, id, ct);
        if (instructor.IsActive) instructor.Deactivate();
        else instructor.Activate();

        uow.FacilityInstructors.Update(instructor);
        await uow.SaveChangesAsync(ct);

        var groupCount = await uow.FacilityGroups.CountByInstructorAsync(id, ct);
        return ToDto(instructor, groupCount);
    }

    private async Task<FacilityInstructor> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var instructor = await uow.FacilityInstructors.GetByIdAsync(id, ct);
        if (instructor is null || instructor.Module != module)
            throw new NotFoundException("Eğitmen bulunamadı.", "INSTRUCTOR_NOT_FOUND");
        return instructor;
    }

    private static FacilityInstructorDto ToDto(FacilityInstructor i, int groupCount)
        => new(i.Id, i.Module, i.FullName, i.Tckn, i.Phone, i.Email, i.Specialty, groupCount, i.IsActive, i.CreatedAt);
}
