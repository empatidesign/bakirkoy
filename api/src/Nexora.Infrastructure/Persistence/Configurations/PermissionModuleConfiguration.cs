using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class PermissionModuleConfiguration : IEntityTypeConfiguration<PermissionModule>
{
    public void Configure(EntityTypeBuilder<PermissionModule> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Key).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Group).IsRequired().HasMaxLength(80);

        builder.HasIndex(x => x.Key).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
