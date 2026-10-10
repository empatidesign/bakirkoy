using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ScopeNodeConfiguration : IEntityTypeConfiguration<ScopeNode>
{
    public void Configure(EntityTypeBuilder<ScopeNode> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Type).IsRequired().HasMaxLength(40);
        builder.Property(x => x.RefModuleKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);

        builder.HasIndex(x => new { x.RefModuleKey, x.RefId });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
