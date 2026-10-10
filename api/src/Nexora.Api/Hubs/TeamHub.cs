using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;

namespace Nexora.Api.Hubs;

// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR SignalR denetimi, madde #32):
// REST tarafında her kütüphane işlemi LibraryOperationsService.EnsureInScopeAsync ile
// korunurken (library.view izni + IUserScopeService kapsam kontrolü), bu hub'daki
// JoinLibrary/LeaveLibrary metodları önceden hiçbir izin/kapsam kontrolü yapmadan
// herhangi bir admin'i herhangi bir kütüphanenin canlı doluluk/kuyruk/oturum verisine
// abone ediyordu. Artık REST ile aynı desen (library.view izni + scope) uygulanıyor.
[Authorize("AdminOrAbove")]
public class TeamHub(IUnitOfWork uow, IUserScopeService userScope) : Hub
{
    public static string GroupFor(Guid userId) => $"team-user:{userId}";

    public static string LibraryGroupFor(Guid libraryId) => $"library-admin:{libraryId}";

    // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR SignalR denetimi, madde #33): "application-changed"
    // broadcast'i önceden Clients.All'a gidiyordu; events.view izni olmayan HER admin
    // (ambulans/eczane/kütüphane vb. tamamen ilgisiz modül yöneticileri dahil) katılımcının
    // tam adını ve başvuru detayını görebiliyordu. Artık yalnızca bu grubu dinleyen (izinli)
    // bağlantılara gönderiliyor.
    public const string EventsViewersGroup = "events-viewers";

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(Guid.Parse(userId)));

        if (await CanViewEventsAsync())
            await Groups.AddToGroupAsync(Context.ConnectionId, EventsViewersGroup);

        await base.OnConnectedAsync();
    }

    private async Task<bool> CanViewEventsAsync()
    {
        var isSuperAdmin = string.Equals(
            Context.User?.FindFirstValue("is_super_admin"), "true", StringComparison.OrdinalIgnoreCase);
        if (isSuperAdmin) return true;

        var rawId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                 ?? Context.User?.FindFirstValue("sub");
        if (!Guid.TryParse(rawId, out var userId)) return false;

        return await uow.HasPermissionAsync(userId, "events.view", Context.ConnectionAborted);
    }

    public async Task JoinLibrary(string libraryId)
    {
        if (!Guid.TryParse(libraryId, out var id)) return;
        if (!await CanAccessLibraryAsync(id))
            throw new HubException("Bu kütüphaneye erişim izniniz yok.");
        await Groups.AddToGroupAsync(Context.ConnectionId, LibraryGroupFor(id));
    }

    public Task LeaveLibrary(string libraryId)
        => Guid.TryParse(libraryId, out var id)
            ? Groups.RemoveFromGroupAsync(Context.ConnectionId, LibraryGroupFor(id))
            : Task.CompletedTask;

    private async Task<bool> CanAccessLibraryAsync(Guid libraryId)
    {
        var isSuperAdmin = string.Equals(
            Context.User?.FindFirstValue("is_super_admin"), "true", StringComparison.OrdinalIgnoreCase);
        if (isSuperAdmin) return true;

        var rawId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                 ?? Context.User?.FindFirstValue("sub");
        if (!Guid.TryParse(rawId, out var userId)) return false;

        if (!await uow.HasPermissionAsync(userId, "library.view", Context.ConnectionAborted))
            return false;

        var scopedIds = await userScope.GetScopedRefIdsAsync(userId, "library", Context.ConnectionAborted);
        // null = kısıtsız (tüm kütüphanelere erişimi olan rol); dolu küme = yalnızca içindekiler.
        return scopedIds is null || scopedIds.Contains(libraryId);
    }
}
