using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaSettingsService
{
    Task<SedaSettingsDto> GetAsync(CancellationToken ct);
    Task<SedaSettingsDto> UpdateAsync(UpdateSedaSettingsRequest req, CancellationToken ct);
}
