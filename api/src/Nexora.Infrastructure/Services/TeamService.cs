using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Team;
using Nexora.Application.Features.Team.Dtos;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Team;

namespace Nexora.Infrastructure.Services;

public class TeamService(
    IUnitOfWork uow,
    ITeamScopeService scope,
    INotificationDispatcher dispatcher,
    ITeamRealtimeNotifier realtime,
    INotificationRealtimeNotifier notificationRealtime) : ITeamService
{
    public Task<IReadOnlyList<TeamMemberDto>> GetVisibleMembersAsync(Guid callerId, CancellationToken ct)
        => scope.GetVisibleMembersAsync(callerId, ct);

    public Task<IReadOnlyList<TeamMemberDto>> GetSubordinatesAsync(Guid callerId, CancellationToken ct)
        => scope.GetSubordinatesAsync(callerId, ct);

    public async Task<IReadOnlyList<TeamNoteDto>> GetNotesAsync(Guid callerId, CancellationToken ct)
    {
        var notes = await uow.TeamNotes.GetForUserAsync(callerId, ct);
        var names = await NamesAsync(notes.SelectMany(n => new[] { n.AuthorId, n.TargetUserId }), ct);
        return notes.Select(n => ToNoteDto(n, callerId, names)).ToList();
    }

    public async Task<TeamNoteDto> CreateNoteAsync(Guid callerId, CreateTeamNoteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) && string.IsNullOrWhiteSpace(request.Content))
            throw new ConflictException("Not başlığı veya içeriği gereklidir.", "NOTE_EMPTY");

        var target = request.TargetUserId ?? callerId;
        if (target != callerId && !await scope.IsSuperiorAsync(callerId, target, ct))
            throw new ForbiddenException("Bu kişiye not bırakma yetkiniz yok.", "NOT_SUPERIOR");

        var note = TeamNote.Create(callerId, target, request.Title, request.Content, request.Tone);
        await uow.TeamNotes.AddAsync(note, ct);
        await uow.SaveChangesAsync(ct);

        if (target != callerId)
        {
            await uow.Notifications.AddAsync(Notification.Create(target, "Size bir not bırakıldı", note.Title, "team-note"), ct);
            await uow.SaveChangesAsync(ct);
        }

        var names = await NamesAsync([note.AuthorId, note.TargetUserId], ct);
        return ToNoteDto(note, callerId, names);
    }

    public async Task<TeamNoteDto> UpdateNoteAsync(Guid callerId, Guid id, UpdateTeamNoteRequest request, CancellationToken ct)
    {
        var note = await uow.TeamNotes.GetByIdAsync(id, ct) ?? throw new NotFoundException("Not bulunamadı.", "NOTE_NOT_FOUND");
        if (note.AuthorId != callerId)
            throw new ForbiddenException("Bu notu düzenleme yetkiniz yok.", "NOT_AUTHOR");

        note.Update(request.Title, request.Content, request.Tone);
        uow.TeamNotes.Update(note);
        await uow.SaveChangesAsync(ct);

        var names = await NamesAsync([note.AuthorId, note.TargetUserId], ct);
        return ToNoteDto(note, callerId, names);
    }

    public async Task TogglePinNoteAsync(Guid callerId, Guid id, CancellationToken ct)
    {
        var note = await uow.TeamNotes.GetByIdAsync(id, ct) ?? throw new NotFoundException("Not bulunamadı.", "NOTE_NOT_FOUND");
        if (note.AuthorId != callerId && note.TargetUserId != callerId)
            throw new ForbiddenException("Bu not üzerinde işlem yetkiniz yok.", "NOTE_FORBIDDEN");
        note.TogglePin();
        uow.TeamNotes.Update(note);
        await uow.SaveChangesAsync(ct);
    }

    public async Task DeleteNoteAsync(Guid callerId, Guid id, CancellationToken ct)
    {
        var note = await uow.TeamNotes.GetByIdAsync(id, ct) ?? throw new NotFoundException("Not bulunamadı.", "NOTE_NOT_FOUND");
        if (note.AuthorId != callerId)
            throw new ForbiddenException("Bu notu silme yetkiniz yok.", "NOT_AUTHOR");
        uow.TeamNotes.Delete(note);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<TeamTaskDto>> GetTasksAsync(Guid callerId, CancellationToken ct)
    {
        var tasks = await uow.TeamTasks.GetForUserAsync(callerId, ct);

        var subordinates = await scope.GetSubordinatesAsync(callerId, ct);
        var subordinateIds = subordinates.Select(s => s.Id).ToList();
        if (subordinateIds.Count > 0)
        {
            var subordinateTasks = await uow.TeamTasks.FindAsync(t => subordinateIds.Contains(t.AssigneeId), ct);
            var seen = tasks.Select(t => t.Id).ToHashSet();
            tasks.AddRange(subordinateTasks.Where(t => seen.Add(t.Id)));
        }

        var ordered = tasks
            .OrderBy(t => t.Status == "done")
            .ThenByDescending(t => t.CreatedAt)
            .ToList();

        var names = await NamesAsync(ordered.SelectMany(t => new[] { t.AssignerId, t.AssigneeId }), ct);
        return ordered.Select(t => ToTaskDto(t, callerId, names)).ToList();
    }

    public async Task<TeamTaskDto> CreateTaskAsync(Guid callerId, CreateTeamTaskRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ConflictException("Görev başlığı zorunludur.", "TASK_TITLE_REQUIRED");
        if (!await scope.IsSuperiorAsync(callerId, request.AssigneeId, ct))
            throw new ForbiddenException("Bu kişiye görev atama yetkiniz yok.", "NOT_SUPERIOR");

        var task = TeamTask.Create(callerId, request.AssigneeId, request.Title, request.Description, request.DueDate);
        await uow.TeamTasks.AddAsync(task, ct);
        await uow.Notifications.AddAsync(Notification.Create(request.AssigneeId, "Yeni görev atandı", task.Title, "team-task"), ct);
        await uow.SaveChangesAsync(ct);

        var names = await NamesAsync([task.AssignerId, task.AssigneeId], ct);
        return ToTaskDto(task, callerId, names);
    }

    public async Task<TeamTaskDto> SetTaskStatusAsync(Guid callerId, Guid id, bool done, CancellationToken ct)
    {
        var task = await uow.TeamTasks.GetByIdAsync(id, ct) ?? throw new NotFoundException("Görev bulunamadı.", "TASK_NOT_FOUND");
        if (task.AssigneeId != callerId && task.AssignerId != callerId)
            throw new ForbiddenException("Bu görevi güncelleme yetkiniz yok.", "TASK_FORBIDDEN");

        if (done) task.Complete(); else task.Reopen();
        uow.TeamTasks.Update(task);
        await uow.SaveChangesAsync(ct);

        var names = await NamesAsync([task.AssignerId, task.AssigneeId], ct);
        return ToTaskDto(task, callerId, names);
    }

    public async Task DeleteTaskAsync(Guid callerId, Guid id, CancellationToken ct)
    {
        var task = await uow.TeamTasks.GetByIdAsync(id, ct) ?? throw new NotFoundException("Görev bulunamadı.", "TASK_NOT_FOUND");
        if (task.AssignerId != callerId)
            throw new ForbiddenException("Sadece görevi atayan silebilir.", "TASK_NOT_ASSIGNER");
        uow.TeamTasks.Delete(task);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<TeamMessageDto>> GetThreadAsync(Guid callerId, Guid otherUserId, CancellationToken ct)
    {
        if (!await scope.CanSeeAsync(callerId, otherUserId, ct))
            throw new ForbiddenException("Bu kişiyle mesajlaşma yetkiniz yok.", "NOT_VISIBLE");

        var messages = await uow.TeamMessages.GetThreadAsync(callerId, otherUserId, ct);
        var changed = false;
        foreach (var m in messages.Where(m => m.RecipientId == callerId && m.ReadAt is null))
        {
            m.MarkRead();
            uow.TeamMessages.Update(m);
            changed = true;
        }
        if (changed) await uow.SaveChangesAsync(ct);

        return messages.Select(m => new TeamMessageDto(m.Id, m.SenderId, m.RecipientId, m.Text, m.SenderId == callerId, m.ReadAt, m.CreatedAt)).ToList();
    }

    public async Task<TeamMessageDto> SendMessageAsync(Guid callerId, SendTeamMessageRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            throw new ConflictException("Mesaj boş olamaz.", "MESSAGE_EMPTY");
        var canSee = await scope.CanSeeAsync(callerId, request.RecipientId, ct);
        if (!canSee && !await uow.TeamMessages.HasThreadAsync(callerId, request.RecipientId, ct))
            throw new ForbiddenException("Bu kişiye mesaj gönderme yetkiniz yok.", "NOT_VISIBLE");

        var message = TeamMessage.Create(callerId, request.RecipientId, request.Text);
        await uow.TeamMessages.AddAsync(message, ct);
        await uow.SaveChangesAsync(ct);

        await realtime.MessageSentAsync(
            new TeamRealtimeMessage(message.Id, message.SenderId, message.RecipientId, message.Text, message.CreatedAt), ct);

        return new TeamMessageDto(message.Id, message.SenderId, message.RecipientId, message.Text, true, message.ReadAt, message.CreatedAt);
    }

    public async Task<TeamUnreadSummaryDto> GetUnreadSummaryAsync(Guid callerId, CancellationToken ct)
    {
        var counts = await uow.TeamMessages.GetUnreadCountsBySenderAsync(callerId, ct);
        var perSender = counts.Select(c => new TeamUnreadSenderDto(c.SenderId, c.Count)).ToList();
        return new TeamUnreadSummaryDto(perSender.Sum(p => p.Count), perSender);
    }

    public async Task MarkThreadReadAsync(Guid callerId, Guid otherUserId, CancellationToken ct)
    {
        var messages = await uow.TeamMessages.GetThreadAsync(callerId, otherUserId, ct);
        var changed = false;
        foreach (var m in messages.Where(m => m.RecipientId == callerId && m.ReadAt is null))
        {
            m.MarkRead();
            uow.TeamMessages.Update(m);
            changed = true;
        }
        if (changed) await uow.SaveChangesAsync(ct);
    }

    public async Task SendNotificationAsync(Guid callerId, SendTeamNotificationRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            throw new ConflictException("Mesaj zorunludur.", "MESSAGE_EMPTY");
        if (!await scope.IsSuperiorAsync(callerId, request.RecipientId, ct))
            throw new ForbiddenException("Bu kişiye bildirim/uyarı gönderme yetkiniz yok.", "NOT_SUPERIOR");

        var type = string.Equals(request.Kind, "warning", StringComparison.OrdinalIgnoreCase) ? "team-warning" : "team-info";
        var title = string.IsNullOrWhiteSpace(request.Title) ? (type == "team-warning" ? "Uyarı" : "Bilgilendirme") : request.Title.Trim();

        var notification = Notification.Create(request.RecipientId, title, request.Message.Trim(), type);
        await uow.Notifications.AddAsync(notification, ct);
        await uow.SaveChangesAsync(ct);

        await notificationRealtime.NotifyAdminAsync(
            notification.RecipientId,
            new AdminNotificationPayload(notification.Id, notification.Title, notification.Body, notification.Type, notification.ReferenceId, notification.CreatedAt),
            ct);

        if (request.AlsoSms)
        {
            var user = await uow.AdminUsers.GetByIdAsync(request.RecipientId, ct);
            if (user is not null && !string.IsNullOrWhiteSpace(user.Phone))
                await dispatcher.SendSmsAsync(user.Phone!, $"{title}: {request.Message.Trim()}", ct);
        }
    }

    public async Task<IReadOnlyList<TeamNotificationDto>> GetMyNotificationsAsync(Guid callerId, CancellationToken ct)
    {
        var paged = await uow.Notifications.GetTeamPagedByRecipientAsync(callerId, 1, 50, ct);
        return paged.Items
            .Select(n => new TeamNotificationDto(n.Id, n.Title, n.Body, n.Type, n.IsRead, n.CreatedAt, n.ReferenceType, n.ReferenceId))
            .ToList();
    }

    public async Task<int> GetMyUnreadNotificationCountAsync(Guid callerId, CancellationToken ct)
        => await uow.Notifications.GetTeamUnreadCountByRecipientAsync(callerId, ct);

    public async Task MarkNotificationReadAsync(Guid callerId, Guid id, CancellationToken ct)
    {
        var notification = await uow.Notifications.GetByIdForRecipientsAsync(id, [callerId], ct)
            ?? throw new NotFoundException("Bildirim bulunamadı.", "NOTIFICATION_NOT_FOUND");
        notification.MarkRead();
        uow.Notifications.Update(notification);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<Dictionary<Guid, string>> NamesAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0) return [];
        var users = await uow.AdminUsers.FindAsync(u => list.Contains(u.Id), ct);
        return users.ToDictionary(u => u.Id, u => u.FullName);
    }

    private static string Name(Dictionary<Guid, string> names, Guid id) => names.TryGetValue(id, out var n) ? n : "—";

    private static TeamNoteDto ToNoteDto(TeamNote n, Guid caller, Dictionary<Guid, string> names)
        => new(n.Id, n.AuthorId, Name(names, n.AuthorId), n.TargetUserId, Name(names, n.TargetUserId),
            n.Title, n.Content, n.Tone, n.Pinned, n.AuthorId == caller, n.CreatedAt);

    private static TeamTaskDto ToTaskDto(TeamTask t, Guid caller, Dictionary<Guid, string> names)
        => new(t.Id, t.AssignerId, Name(names, t.AssignerId), t.AssigneeId, Name(names, t.AssigneeId),
            t.Title, t.Description, t.Status, t.DueDate, t.CompletedAt, t.AssignerId == caller, t.AssigneeId == caller, t.CreatedAt);
}
