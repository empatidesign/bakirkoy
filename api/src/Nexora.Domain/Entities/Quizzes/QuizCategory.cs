using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Quizzes;

public class QuizCategory : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Color { get; private set; } = string.Empty;
    public Guid? ParentId { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static QuizCategory Create(string name, string? description, string color, Guid? parentId)
        => new()
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Color = color.Trim(),
            ParentId = parentId,
        };

    public void Update(string name, string? description, string color, Guid? parentId)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Color = color.Trim();
        ParentId = parentId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
