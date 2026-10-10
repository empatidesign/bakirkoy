using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Key).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Description).HasMaxLength(300);
        builder.Property(x => x.Color).IsRequired().HasMaxLength(9).HasDefaultValue("");
        builder.Property(x => x.IsSuperAdmin).HasDefaultValue(false);

        builder.HasIndex(x => x.Key).IsUnique();
        builder.HasIndex(x => x.Name).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
