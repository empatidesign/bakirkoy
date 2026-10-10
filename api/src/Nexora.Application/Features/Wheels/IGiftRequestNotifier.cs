using Nexora.Domain.Entities.Wheels;

namespace Nexora.Application.Features.Wheels;

public interface IGiftRequestNotifier
{
    Task NotifyNewRequestAsync(GiftRequest request, CancellationToken ct);
}
