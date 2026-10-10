using Nexora.Application.Features.Team.Dtos;

namespace Nexora.Application.Features.Team;

public interface ITeamService
{
    Task<IReadOnlyList<TeamMemberDto>> GetVisibleMembersAsync(Guid callerId, CancellationToken ct);
    Task<IReadOnlyList<TeamMemberDto>> GetSubordinatesAsync(Guid callerId, CancellationToken ct);

    Task<IReadOnlyList<TeamNoteDto>> GetNotesAsync(Guid callerId, CancellationToken ct);
    Task<TeamNoteDto> CreateNoteAsync(Guid callerId, CreateTeamNoteRequest request, CancellationToken ct);
    Task<TeamNoteDto> UpdateNoteAsync(Guid callerId, Guid id, UpdateTeamNoteRequest request, CancellationToken ct);
    Task TogglePinNoteAsync(Guid callerId, Guid id, CancellationToken ct);
    Task DeleteNoteAsync(Guid callerId, Guid id, CancellationToken ct);

    Task<IReadOnlyList<TeamTaskDto>> GetTasksAsync(Guid callerId, CancellationToken ct);
    Task<TeamTaskDto> CreateTaskAsync(Guid callerId, CreateTeamTaskRequest request, CancellationToken ct);
    Task<TeamTaskDto> SetTaskStatusAsync(Guid callerId, Guid id, bool done, CancellationToken ct);
    Task DeleteTaskAsync(Guid callerId, Guid id, CancellationToken ct);

    Task<IReadOnlyList<TeamMessageDto>> GetThreadAsync(Guid callerId, Guid otherUserId, CancellationToken ct);
    Task<TeamMessageDto> SendMessageAsync(Guid callerId, SendTeamMessageRequest request, CancellationToken ct);
    Task<TeamUnreadSummaryDto> GetUnreadSummaryAsync(Guid callerId, CancellationToken ct);
    Task MarkThreadReadAsync(Guid callerId, Guid otherUserId, CancellationToken ct);

    Task SendNotificationAsync(Guid callerId, SendTeamNotificationRequest request, CancellationToken ct);
    Task<IReadOnlyList<TeamNotificationDto>> GetMyNotificationsAsync(Guid callerId, CancellationToken ct);
    Task<int> GetMyUnreadNotificationCountAsync(Guid callerId, CancellationToken ct);
    Task MarkNotificationReadAsync(Guid callerId, Guid id, CancellationToken ct);
}
