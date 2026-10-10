using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Presence;
using Nexora.Application.Features.Presence.Dtos;
using Nexora.Application.Features.Team;
using Nexora.Application.Features.Team.Dtos;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

public class PresenceService(
    IUnitOfWork uow,
    IRedisService redis,
    ITeamScopeService teamScope,
    INotificationDispatcher dispatcher,
    INotificationRealtimeNotifier realtime,
    IConfiguration config) : IPresenceService
{
    private const string OnlineSetKey = "presence:online";

    private static readonly HashSet<string> KnownDevices = ["web", "ios", "android"];

    private int OnlineTimeoutSeconds => config.GetValue("PresenceSettings:OnlineTimeoutSeconds", 60);

    private static long NowEpoch => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    private static string UserKey(Guid userId) => $"presence:user:{userId}";

    public async Task HeartbeatAsync(Guid userId, string? device, CancellationToken ct)
    {
        var normalized = (device ?? "web").ToLowerInvariant();
        if (!KnownDevices.Contains(normalized)) normalized = "web";

        await redis.SetAsync(UserKey(userId), new PresenceData(normalized, NowEpoch), TimeSpan.FromSeconds(OnlineTimeoutSeconds), ct);
        await redis.SetAddAsync(OnlineSetKey, userId.ToString(), null, ct);
    }

    public async Task GoOfflineAsync(Guid userId, CancellationToken ct)
    {
        await redis.SetRemoveAsync(OnlineSetKey, userId.ToString(), ct);
        await redis.RemoveAsync(UserKey(userId), ct);
    }

    public async Task<IReadOnlyList<OnlinePersonDto>> GetOnlineVisibleAsync(Guid callerId, CancellationToken ct)
    {
        var members = (await teamScope.GetVisibleMembersAsync(callerId, ct)).ToList();
        var seen = members.Select(m => m.Id).ToHashSet();

        var partnerIds = await uow.TeamMessages.GetConversationPartnerIdsAsync(callerId, ct);
        foreach (var partnerId in partnerIds)
        {
            if (seen.Contains(partnerId)) continue;
            if (!await teamScope.CanSeeAsync(callerId, partnerId, ct)) continue;
            var profile = await teamScope.GetProfileAsync(partnerId, ct);
            if (profile is null) continue;
            members.Add(new TeamMemberDto(profile.UserId, profile.FullName, profile.RoleName, profile.RoleColor, profile.FacilityName, profile.BranchName));
            seen.Add(partnerId);
        }

        var result = new List<OnlinePersonDto>();

        foreach (var member in members)
        {
            var data = await redis.GetAsync<PresenceData>(UserKey(member.Id), ct);
            var online = data is not null;
            var lastSeen = online ? (int)Math.Max(0, NowEpoch - data!.LastSeenEpoch) : 0;
            var device = data?.Device ?? "web";

            result.Add(new OnlinePersonDto(
                member.Id, member.FullName, member.RoleName, member.RoleColor,
                member.FacilityName, member.BranchName, device, lastSeen, online));
        }

        return result.OrderByDescending(p => p.Online).ThenBy(p => p.FullName).ToList();
    }

    public async Task<PresenceBroadcastResult> BroadcastAsync(Guid callerId, PresenceBroadcastRequest request, CancellationToken ct)
    {
        var message = request.Message?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(message))
            throw new ConflictException("Mesaj boş olamaz.", "MESSAGE_EMPTY");

        var roster = await GetOnlineVisibleAsync(callerId, ct);
        var recipients = roster.Where(p => p.Online).ToList();
        if (recipients.Count == 0)
            return new PresenceBroadcastResult(0);

        const string title = "Duyuru";
        var notifications = recipients
            .Select(p => Notification.Create(p.Id, title, message, "team-info"))
            .ToList();

        await uow.Notifications.AddRangeAsync(notifications, ct);
        await uow.SaveChangesAsync(ct);

        foreach (var n in notifications)
            await realtime.NotifyAdminAsync(
                n.RecipientId,
                new AdminNotificationPayload(n.Id, n.Title, n.Body, n.Type, n.ReferenceId, n.CreatedAt),
                ct);

        if (request.AlsoSms)
        {
            foreach (var person in recipients)
            {
                var user = await uow.AdminUsers.GetByIdAsync(person.Id, ct);
                if (user is null || string.IsNullOrWhiteSpace(user.Phone)) continue;
                await dispatcher.SendSmsAsync(user.Phone!, $"{title}: {message}", ct);
            }
        }

        return new PresenceBroadcastResult(notifications.Count);
    }

    private record PresenceData(string Device, long LastSeenEpoch);
}
