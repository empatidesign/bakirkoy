using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.IconType).HasConversion<int>();
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);
        builder.Property(x => x.LinkType).HasConversion<int>();
        builder.Property(x => x.LinkTarget).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.ModuleKey).HasMaxLength(60);
        builder.Property(x => x.BadgeText).HasMaxLength(20);
        builder.Property(x => x.BadgeTone).HasMaxLength(20);

        builder.HasIndex(x => x.Order);
        builder.HasIndex(x => x.ModuleKey);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
