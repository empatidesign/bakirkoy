using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Repositories;

namespace Nexora.Api.Hubs;

[Authorize("AdminOrAbove")]
public class DeviceMonitorHub(IUnitOfWork uow) : Hub
{
    public const string GroupName = "device-monitor-live";
    private const string RequiredPermission = "device-monitor.view";

    public override async Task OnConnectedAsync()
    {
        var isSuperAdmin = string.Equals(
            Context.User?.FindFirstValue("is_super_admin"), "true", StringComparison.OrdinalIgnoreCase);

        if (!isSuperAdmin)
        {
            var rawId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? Context.User?.FindFirstValue("sub");

            if (!Guid.TryParse(rawId, out var userId)
                || !await uow.HasPermissionAsync(userId, RequiredPermission, Context.ConnectionAborted))
            {
                Context.Abort();
                return;
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName);
        await base.OnConnectedAsync();
    }
}
