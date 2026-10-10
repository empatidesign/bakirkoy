using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels;

public interface IGiftApplicationService
{
    Task<GiftRequestDto> ApplyAsync(Guid giftId, CancellationToken ct);
}
