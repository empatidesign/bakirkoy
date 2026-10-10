using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Api.Hubs;

public class DashboardRealtimeNotifier(
    IHubContext<TeamHub> teamHub,
    ILogger<DashboardRealtimeNotifier> logger)
    : IDashboardRealtimeNotifier
{
    public async Task NotifyApplicationChangedAsync(DashboardApplicationEvent payload, CancellationToken ct = default)
    {
        try
        {
            // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR SignalR denetimi, madde #33): Clients.All yerine
            // yalnızca events.view iznine sahip bağlantıların üye olduğu gruba gönderiliyor
            // (bkz. TeamHub.EventsViewersGroup/OnConnectedAsync). Önceden events.view izni
            // olmayan her admin (dashboard.view + tamamen ilgisiz modül izinleriyle) katılımcının
            // tam adı ve başvuru detayını görebiliyordu.
            await teamHub.Clients.Group(TeamHub.EventsViewersGroup).SendAsync("application-changed", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "application-changed bildirimi gönderilemedi ({Module}/{Action})", payload.Module, payload.Action);
        }
    }

    public async Task NotifyReservationChangedAsync(DashboardReservationEvent payload, CancellationToken ct = default)
    {
        try
        {
            await teamHub.Clients.All.SendAsync("reservation-changed", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "reservation-changed bildirimi gönderilemedi ({Module}/{Action})", payload.Module, payload.Action);
        }
    }
}
