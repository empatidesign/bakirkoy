using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Authority;

public class AdminScope : BaseEntity
{
    public Guid AdminUserId { get; private set; }
    public Guid ScopeNodeId { get; private set; }
    public bool IncludeDescendants { get; private set; } = true;

    public static AdminScope Create(Guid adminUserId, Guid scopeNodeId, bool includeDescendants = true)
        => new()
        {
            AdminUserId = adminUserId,
            ScopeNodeId = scopeNodeId,
            IncludeDescendants = includeDescendants,
        };
}
