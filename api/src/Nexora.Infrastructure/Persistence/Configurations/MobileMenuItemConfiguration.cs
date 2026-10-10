using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MobileMenuItemConfiguration : IEntityTypeConfiguration<MobileMenuItem>
{
    public void Configure(EntityTypeBuilder<MobileMenuItem> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.IconType).HasConversion<int>();
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ColorSecondary).HasMaxLength(20);
        builder.Property(x => x.Description).HasMaxLength(200);
        builder.Property(x => x.LinkType).HasConversion<int>();
        builder.Property(x => x.LinkTarget).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.GroupKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.GroupTitle).IsRequired().HasMaxLength(120);

        builder.HasIndex(x => x.GroupKey);
        builder.HasIndex(x => x.Order);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
