using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Features.Team;

namespace Nexora.Api.Hubs;

public class TeamRealtimeNotifier(IHubContext<TeamHub> hub) : ITeamRealtimeNotifier
{
    public Task MessageSentAsync(TeamRealtimeMessage message, CancellationToken ct = default)
        => hub.Clients
            .Groups(TeamHub.GroupFor(message.RecipientId), TeamHub.GroupFor(message.SenderId))
            .SendAsync("message", message, ct);
}
