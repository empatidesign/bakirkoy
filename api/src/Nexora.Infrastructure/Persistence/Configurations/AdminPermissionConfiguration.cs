using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class AdminPermissionConfiguration : IEntityTypeConfiguration<AdminPermission>
{
    public void Configure(EntityTypeBuilder<AdminPermission> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Effect).IsRequired().HasMaxLength(10);

        builder.HasIndex(x => x.AdminUserId);
        builder.HasIndex(x => new { x.AdminUserId, x.PermissionId }).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
