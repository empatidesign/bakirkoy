using MapsterMapper;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Departments;
using Nexora.Application.Features.Departments.Dtos;
using Nexora.Domain.Entities.Organization;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class DepartmentService(
    IUnitOfWork uow,
    IMapper mapper,
    IAuditService audit,
    IActivityLogger log) : IDepartmentService
{
    public async Task<PagedResult<DepartmentDto>> GetPagedAsync(DepartmentListParams p, CancellationToken ct)
    {
        var paged = await uow.Departments.GetPagedAsync(p, ct);
        var names = paged.Items.Select(d => d.Name).ToList();
        var counts = await uow.AdminUsers.CountByDepartmentsAsync(names, ct);

        return new PagedResult<DepartmentDto>
        {
            Items = paged.Items.Select(d => ToDto(d, counts.GetValueOrDefault(d.Name))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<DepartmentOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.Departments.GetActiveAsync(ct);
        return mapper.Map<List<DepartmentOptionDto>>(items);
    }

    public async Task<DepartmentDto> CreateAsync(CreateDepartmentRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.Departments.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu departman adı zaten kullanılıyor.", "DUPLICATE_DEPARTMENT");

        var department = Department.Create(req.Name, req.Description);

        await uow.Departments.AddAsync(department, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Department",
            EntityId = department.Id,
            Module = "Departments",
            Description = $"Departman oluşturuldu: {department.Name}",
        }, ct);

        return ToDto(department, 0);
    }

    public async Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var department = await uow.Departments.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Departman bulunamadı.", "DEPARTMENT_NOT_FOUND");

        if (await uow.Departments.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu departman adı zaten kullanılıyor.", "DUPLICATE_DEPARTMENT");

        var oldName = department.Name;
        var oldDescription = department.Description;
        department.Update(req.Name, req.Description);

        uow.Departments.Update(department);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Department",
            EntityId = department.Id,
            Module = "Departments",
            Description = $"Departman güncellendi: {department.Name}",
            OldValues = System.Text.Json.JsonSerializer.Serialize(new { Name = oldName, Description = oldDescription }),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { department.Name, department.Description }),
        }, ct);

        // P0 düzeltmesi: Departments.Name <-> AdminUsers.Department FK olmadığından, isim
        // değiştiğinde bağlı AdminUser kayıtlarını da güncelliyoruz. Aksi halde eski isimle
        // eşleşen adminler "yetim" kalır: silme koruması ve pasife-alma cascade'i onları kaçırır.
        if (!string.Equals(oldName, department.Name, StringComparison.Ordinal))
        {
            var renamed = await uow.AdminUsers.RenameDepartmentAsync(oldName, department.Name, ct);
            if (renamed > 0)
            {
                log.LogStepResult(nameof(UpdateAsync), new
                {
                    OldName = oldName,
                    NewName = department.Name,
                    UpdatedAdmins = renamed,
                    Note = "Departman adı değişti; bağlı yöneticilerin departman alanı da güncellendi.",
                });
            }
        }

        var count = await uow.AdminUsers.CountByDepartmentAsync(department.Name, ct);
        return ToDto(department, count);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        var department = await uow.Departments.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Departman bulunamadı.", "DEPARTMENT_NOT_FOUND");

        var count = await uow.AdminUsers.CountByDepartmentAsync(department.Name, ct);
        if (count > 0)
            throw new ConflictException($"Bu departman {count} yöneticiye atanmış olduğu için silinemez. Önce ilgili yöneticilerin departmanını değiştirin.", "DEPARTMENT_IN_USE");

        uow.Departments.Delete(department);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Department",
            EntityId = department.Id,
            Module = "Departments",
            Description = $"Departman silindi: {department.Name}",
        }, ct);
    }

    public async Task<DepartmentDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var department = await uow.Departments.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Departman bulunamadı.", "DEPARTMENT_NOT_FOUND");

        if (department.IsActive)
        {
            department.Deactivate();

            var allRoles = await uow.Roles.GetAllAsync(ct);
            var superAdminRoleIds = allRoles.Where(r => r.IsSuperAdmin).Select(r => r.Id).ToHashSet();

            var candidates = await uow.AdminUsers.FindAsync(
                a => a.Department == department.Name && a.IsActive, ct);
            var affected = candidates
                .Where(a => !superAdminRoleIds.Contains(a.RoleId))
                .ToList();

            foreach (var admin in affected)
            {
                admin.Deactivate();
                uow.AdminUsers.Update(admin);
            }

            log.LogStepResult(nameof(ToggleStatusAsync), new
            {
                Department = department.Name,
                CascadedAdmins = affected.Count,
                Note = "Departman pasife alındı; bağlı yöneticiler de pasife alındı.",
            });
        }
        else
        {
            department.Activate();
        }

        uow.Departments.Update(department);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Department",
            EntityId = department.Id,
            Module = "Departments",
            Description = $"Departman durumu değişti: {department.Name} -> {(department.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        var count = await uow.AdminUsers.CountByDepartmentAsync(department.Name, ct);
        return ToDto(department, count);
    }

    private static DepartmentDto ToDto(Department d, int assignedCount)
        => new(d.Id, d.Name, d.Description, d.IsActive, d.CreatedAt, assignedCount);
}
