using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events;

public interface IEventSettingsService
{
    Task<EventSettingsDto> GetAsync(CancellationToken ct);
    Task<EventSettingsDto> SaveAsync(EventSettingsDto dto, CancellationToken ct);
}
