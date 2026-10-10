using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Nexora.Api.Hubs;

[AllowAnonymous]
public class MobileConfigHub : Hub
{
}
