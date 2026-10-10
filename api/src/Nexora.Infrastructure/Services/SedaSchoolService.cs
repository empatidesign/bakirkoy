using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SedaSchoolService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : ISedaSchoolService
{
    public async Task<PagedResult<SedaSchoolDto>> GetPagedAsync(SedaSchoolListParams p, CancellationToken ct)
    {
        var paged = await uow.SedaSchools.GetPagedAsync(p, ct);
        var names = paged.Items.Select(s => s.Name).ToList();
        var counts = await uow.SedaApplications.CountBySchoolNamesAsync(names, ct);

        return new PagedResult<SedaSchoolDto>
        {
            Items = paged.Items.Select(s => ToDto(s, counts.GetValueOrDefault(s.Name))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<SedaOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.SedaSchools.GetActiveAsync(ct);
        return items.Select(s => new SedaOptionDto(s.Name, s.Name)).ToList();
    }

    public async Task<SedaSchoolDto> CreateAsync(SedaSchoolFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.SedaSchools.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu okul adı zaten kayıtlı.", "DUPLICATE_SEDA_SCHOOL");

        var school = SedaSchool.Create(req.Name.Trim());
        await uow.SedaSchools.AddAsync(school, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaSchool",
            EntityId = school.Id,
            Module = "Seda",
            Description = $"SEDA okulu eklendi: {school.Name}",
        }, ct);

        return ToDto(school, 0);
    }

    public async Task<SedaSchoolDto> UpdateAsync(Guid id, SedaSchoolFormRequest req, CancellationToken ct)
    {
        var school = await uow.SedaSchools.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Okul bulunamadı.", "SEDA_SCHOOL_NOT_FOUND");

        if (await uow.SedaSchools.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu okul adı zaten kayıtlı.", "DUPLICATE_SEDA_SCHOOL");

        var oldName = school.Name;

        school.Update(req.Name.Trim());
        uow.SedaSchools.Update(school);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SedaSchool",
            EntityId = school.Id,
            Module = "Seda",
            Description = $"SEDA okulu güncellendi: {oldName} → {school.Name}",
        }, ct);

        var counts = await uow.SedaApplications.CountBySchoolNamesAsync([school.Name], ct);
        return ToDto(school, counts.GetValueOrDefault(school.Name));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var school = await uow.SedaSchools.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Okul bulunamadı.", "SEDA_SCHOOL_NOT_FOUND");

        var usage = await uow.SedaApplications.CountBySchoolNamesAsync([school.Name], ct);
        if (usage.GetValueOrDefault(school.Name) > 0)
            throw new ConflictException("Bu okula ait başvuru bulunduğu için okul silinemez. Gerekirse pasife alın.", "SEDA_SCHOOL_IN_USE");

        uow.SedaSchools.Delete(school);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "SedaSchool",
            EntityId = school.Id,
            Module = "Seda",
            Description = $"SEDA okulu silindi: {school.Name}",
        }, ct);
    }

    public async Task<SedaSchoolDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var school = await uow.SedaSchools.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Okul bulunamadı.", "SEDA_SCHOOL_NOT_FOUND");

        if (school.IsActive) school.Deactivate();
        else school.Activate();

        uow.SedaSchools.Update(school);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "SedaSchool",
            EntityId = school.Id,
            Module = "Seda",
            Description = $"SEDA okulu {(school.IsActive ? "aktif edildi" : "pasife alındı")}: {school.Name}",
        }, ct);

        var counts = await uow.SedaApplications.CountBySchoolNamesAsync([school.Name], ct);
        return ToDto(school, counts.GetValueOrDefault(school.Name));
    }

    private static SedaSchoolDto ToDto(SedaSchool s, int applicationCount)
        => new(s.Id, s.Name, s.IsActive, applicationCount, s.CreatedAt);
}
