namespace Nexora.Application.Features.MobileConfig;

public interface IMobileConfigRealtimeNotifier
{
    Task NotifyConfigChangedAsync(CancellationToken ct = default);
}
