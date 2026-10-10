using Nexora.Application.Features.Permissions.Dtos;

namespace Nexora.Application.Features.Permissions;

public interface IPermissionService
{
    Task<List<CatalogModuleDto>> GetCatalogAsync(CancellationToken ct);
}
