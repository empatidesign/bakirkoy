using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Team;

public class TeamNote : BaseEntity
{
    public Guid AuthorId { get; private set; }
    public Guid TargetUserId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public string Tone { get; private set; } = "warning";
    public bool Pinned { get; private set; }

    public static TeamNote Create(Guid authorId, Guid targetUserId, string title, string content, string tone)
        => new()
        {
            AuthorId = authorId,
            TargetUserId = targetUserId,
            Title = string.IsNullOrWhiteSpace(title) ? "Başlıksız" : title.Trim(),
            Content = content?.Trim() ?? string.Empty,
            Tone = string.IsNullOrWhiteSpace(tone) ? "warning" : tone,
        };

    public void Update(string title, string content, string tone)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Başlıksız" : title.Trim();
        Content = content?.Trim() ?? string.Empty;
        Tone = string.IsNullOrWhiteSpace(tone) ? Tone : tone;
        UpdatedAt = DateTime.UtcNow;
    }

    public void TogglePin()
    {
        Pinned = !Pinned;
        UpdatedAt = DateTime.UtcNow;
    }
}
