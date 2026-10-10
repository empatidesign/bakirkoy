using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface ITravelInviteSmsJob
{
    Task SendAsync(string phone, string message, CancellationToken ct = default);
}

public class TravelInviteSmsJob(INotificationDispatcher dispatcher) : ITravelInviteSmsJob
{
    public async Task SendAsync(string phone, string message, CancellationToken ct = default)
        => await dispatcher.SendSmsAsync(phone, message, ct);
}
