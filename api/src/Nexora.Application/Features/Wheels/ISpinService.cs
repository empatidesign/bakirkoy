using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels;

public interface ISpinService
{
    Task<WheelSpinResultDto> SpinAsync(Guid wheelId, CancellationToken ct);
}
