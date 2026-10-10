using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Nexora.Api.Hubs;

[Authorize("Citizen")]
public class CitizenHub : Hub
{
    public static string GroupFor(Guid participantId) => $"citizen-user:{participantId}";

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(Guid.Parse(userId)));
        await base.OnConnectedAsync();
    }
}
