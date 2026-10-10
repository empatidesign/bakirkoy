using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelSettingsService
{
    Task<TravelSettingsDto> GetAsync(CancellationToken ct);
    Task<TravelSettingsDto> SaveAsync(TravelSettingsDto req, CancellationToken ct);
}
