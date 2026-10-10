using Nexora.Application.Features.CitizenMenu.Dtos;

namespace Nexora.Application.Features.CitizenMenu;

public interface ICitizenMenuService
{
    Task<CitizenMenuDto> GetAsync(CancellationToken ct);
    Task<CitizenMenuDto> UpdateAsync(UpdateCitizenMenuRequest req, CancellationToken ct);
}
