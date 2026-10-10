namespace Nexora.Application.Features.Team.Dtos;

public record TeamMemberDto(
    Guid Id,
    string FullName,
    string RoleName,
    string? RoleColor,
    string? FacilityName,
    string? BranchName);

public record TeamNoteDto(
    Guid Id,
    Guid AuthorId,
    string AuthorName,
    Guid TargetUserId,
    string TargetName,
    string Title,
    string Content,
    string Tone,
    bool Pinned,
    bool Mine,
    DateTime CreatedAt);

public record CreateTeamNoteRequest(Guid? TargetUserId, string Title, string Content, string Tone);

public record UpdateTeamNoteRequest(string Title, string Content, string Tone);

public record TeamTaskDto(
    Guid Id,
    Guid AssignerId,
    string AssignerName,
    Guid AssigneeId,
    string AssigneeName,
    string Title,
    string? Description,
    string Status,
    DateTime? DueDate,
    DateTime? CompletedAt,
    bool AssignedByMe,
    bool AssignedToMe,
    DateTime CreatedAt);

public record CreateTeamTaskRequest(Guid AssigneeId, string Title, string? Description, DateTime? DueDate);

public record TeamMessageDto(
    Guid Id,
    Guid SenderId,
    Guid RecipientId,
    string Text,
    bool Mine,
    DateTime? ReadAt,
    DateTime SentAt);

public record SendTeamMessageRequest(Guid RecipientId, string Text);

public record TeamUnreadSenderDto(Guid SenderId, int Count);

public record TeamUnreadSummaryDto(int Total, List<TeamUnreadSenderDto> PerSender);

public record SendTeamNotificationRequest(Guid RecipientId, string Title, string Message, string Kind, bool AlsoSms);

public record TeamNotificationDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsRead,
    DateTime CreatedAt,
    string? ReferenceType,
    string? ReferenceId);
