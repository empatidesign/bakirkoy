using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Authority;

public class ScopeEdge : BaseEntity
{
    public Guid ParentNodeId { get; private set; }
    public Guid ChildNodeId { get; private set; }

    public static ScopeEdge Create(Guid parentNodeId, Guid childNodeId)
        => new() { ParentNodeId = parentNodeId, ChildNodeId = childNodeId };
}
