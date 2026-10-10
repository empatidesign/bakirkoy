using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Team;

public class TeamTask : BaseEntity
{
    public Guid AssignerId { get; private set; }
    public Guid AssigneeId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Status { get; private set; } = "pending";
    public DateTime? DueDate { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public static TeamTask Create(Guid assignerId, Guid assigneeId, string title, string? description, DateTime? dueDate)
        => new()
        {
            AssignerId = assignerId,
            AssigneeId = assigneeId,
            Title = title.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            DueDate = dueDate,
            Status = "pending",
        };

    public void Update(string title, string? description, DateTime? dueDate)
    {
        Title = title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        DueDate = dueDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Complete()
    {
        if (Status == "done") return;
        Status = "done";
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reopen()
    {
        if (Status == "pending") return;
        Status = "pending";
        CompletedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
