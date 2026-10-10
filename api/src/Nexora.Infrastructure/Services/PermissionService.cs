using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Permissions;
using Nexora.Application.Features.Permissions.Dtos;

namespace Nexora.Infrastructure.Services;

public class PermissionService(IUnitOfWork uow) : IPermissionService
{
    public async Task<List<CatalogModuleDto>> GetCatalogAsync(CancellationToken ct)
    {
        var modules = await uow.PermissionModules.GetAllOrderedAsync(ct);
        var permissions = await uow.Permissions.GetActiveAsync(ct);

        var actionsByModule = permissions
            .GroupBy(p => p.ModuleKey)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Action).ToList());

        return modules
            .Where(m => m.IsActive)
            .Select(m => new CatalogModuleDto(
                m.Key,
                m.Name,
                m.Group,
                m.DisplayOrder,
                m.Scopable,
                actionsByModule.TryGetValue(m.Key, out var acts) ? acts : new List<string>()))
            .ToList();
    }
}
