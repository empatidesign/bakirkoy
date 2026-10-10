using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ScopeEdgeConfiguration : IEntityTypeConfiguration<ScopeEdge>
{
    public void Configure(EntityTypeBuilder<ScopeEdge> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.ParentNodeId, x.ChildNodeId }).IsUnique();
        builder.HasIndex(x => x.ChildNodeId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
