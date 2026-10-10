using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SedaDefinitionService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : ISedaDefinitionService
{
    public async Task<PagedResult<SedaDefinitionDto>> GetPagedAsync(SedaDefinitionListParams p, CancellationToken ct)
    {
        var paged = await uow.SedaDefinitions.GetPagedAsync(p, ct);
        return new PagedResult<SedaDefinitionDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<SedaOptionDto>> GetOptionsAsync(string type, CancellationToken ct)
    {
        var items = await uow.SedaDefinitions.GetActiveByTypeAsync(type, ct);
        return items.Select(d => new SedaOptionDto(d.Name, d.Name)).ToList();
    }

    public async Task<SedaDefinitionDto> CreateAsync(CreateSedaDefinitionRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Type, req.Name });

        if (await uow.SedaDefinitions.ExistsByNameAsync(req.Type, req.Name, null, ct))
            throw new ConflictException("Bu kayıt zaten mevcut.", "DUPLICATE_SEDA_DEFINITION");

        var definition = SedaDefinition.Create(req.Type, req.Name.Trim());
        await uow.SedaDefinitions.AddAsync(definition, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaDefinition",
            EntityId = definition.Id,
            Module = "Seda",
            Description = $"SEDA tanımı eklendi ({definition.Type}): {definition.Name}",
        }, ct);

        return ToDto(definition);
    }

    public async Task<SedaDefinitionDto> UpdateAsync(Guid id, UpdateSedaDefinitionRequest req, CancellationToken ct)
    {
        var definition = await uow.SedaDefinitions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tanım bulunamadı.", "SEDA_DEFINITION_NOT_FOUND");

        if (await uow.SedaDefinitions.ExistsByNameAsync(definition.Type, req.Name, id, ct))
            throw new ConflictException("Bu kayıt zaten mevcut.", "DUPLICATE_SEDA_DEFINITION");

        var oldName = definition.Name;

        definition.Update(req.Name.Trim());
        uow.SedaDefinitions.Update(definition);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SedaDefinition",
            EntityId = definition.Id,
            Module = "Seda",
            Description = $"SEDA tanımı güncellendi ({definition.Type}): {oldName} → {definition.Name}",
        }, ct);

        return ToDto(definition);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var definition = await uow.SedaDefinitions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tanım bulunamadı.", "SEDA_DEFINITION_NOT_FOUND");

        uow.SedaDefinitions.Delete(definition);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "SedaDefinition",
            EntityId = definition.Id,
            Module = "Seda",
            Description = $"SEDA tanımı silindi ({definition.Type}): {definition.Name}",
        }, ct);
    }

    public async Task<SedaDefinitionDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var definition = await uow.SedaDefinitions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Tanım bulunamadı.", "SEDA_DEFINITION_NOT_FOUND");

        if (definition.IsActive) definition.Deactivate();
        else definition.Activate();

        uow.SedaDefinitions.Update(definition);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "SedaDefinition",
            EntityId = definition.Id,
            Module = "Seda",
            Description = $"SEDA tanımı {(definition.IsActive ? "aktif edildi" : "pasife alındı")} ({definition.Type}): {definition.Name}",
        }, ct);

        return ToDto(definition);
    }

    private static SedaDefinitionDto ToDto(SedaDefinition d)
        => new(d.Id, d.Type, d.Name, d.IsActive, d.CreatedAt);
}
