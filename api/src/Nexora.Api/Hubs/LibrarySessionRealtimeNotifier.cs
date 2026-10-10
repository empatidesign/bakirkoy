using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Features.Libraries;

namespace Nexora.Api.Hubs;

public class LibrarySessionRealtimeNotifier(
    IHubContext<CitizenHub> citizenHub,
    IHubContext<TeamHub> teamHub,
    ILogger<LibrarySessionRealtimeNotifier> logger)
    : ILibrarySessionRealtimeNotifier
{
    public async Task NotifySessionChangedAsync(Guid participantId, LibrarySessionEvent payload, CancellationToken ct = default)
    {
        try
        {
            await citizenHub.Clients.Group(CitizenHub.GroupFor(participantId))
                .SendAsync("library-session", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-session (citizen) bildirimi gönderilemedi (participant {ParticipantId})", participantId);
        }

        try
        {
            await teamHub.Clients.Group(TeamHub.LibraryGroupFor(payload.LibraryId))
                .SendAsync("library-session", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-session (admin) bildirimi gönderilemedi (library {LibraryId})", payload.LibraryId);
        }
    }

    public async Task NotifyScanDeniedAsync(Guid participantId, LibraryScanDeniedEvent payload, CancellationToken ct = default)
    {
        try
        {
            await citizenHub.Clients.Group(CitizenHub.GroupFor(participantId))
                .SendAsync("library-scan-denied", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-scan-denied bildirimi gönderilemedi (participant {ParticipantId})", participantId);
        }
    }

    public async Task NotifyOccupancyChangedAsync(LibraryOccupancyEvent payload, CancellationToken ct = default)
    {
        try
        {
            await citizenHub.Clients.All.SendAsync("library-occupancy", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-occupancy (citizen) bildirimi gönderilemedi (library {LibraryId})", payload.LibraryId);
        }

        try
        {
            await teamHub.Clients.Group(TeamHub.LibraryGroupFor(payload.LibraryId))
                .SendAsync("library-occupancy", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-occupancy (admin) bildirimi gönderilemedi (library {LibraryId})", payload.LibraryId);
        }
    }

    public async Task NotifyQueueCalledAsync(Guid participantId, LibraryQueueCalledEvent payload, CancellationToken ct = default)
    {
        try
        {
            await citizenHub.Clients.Group(CitizenHub.GroupFor(participantId))
                .SendAsync("library-queue-called", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-queue-called (citizen) bildirimi gönderilemedi (participant {ParticipantId})", participantId);
        }

        try
        {
            await teamHub.Clients.Group(TeamHub.LibraryGroupFor(payload.LibraryId))
                .SendAsync("library-queue-called", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "library-queue-called (admin) bildirimi gönderilemedi (library {LibraryId})", payload.LibraryId);
        }
    }
}
