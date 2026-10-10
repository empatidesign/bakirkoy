using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class AdminScopeConfiguration : IEntityTypeConfiguration<AdminScope>
{
    public void Configure(EntityTypeBuilder<AdminScope> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => x.AdminUserId);
        builder.HasIndex(x => new { x.AdminUserId, x.ScopeNodeId }).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
