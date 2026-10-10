using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MobileMenuBannerConfiguration : IEntityTypeConfiguration<MobileMenuBanner>
{
    public void Configure(EntityTypeBuilder<MobileMenuBanner> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PageKey).IsRequired().HasMaxLength(120);
        builder.Property(x => x.ImageUrl).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.LinkType).HasConversion<int>();
        builder.Property(x => x.LinkTarget).HasMaxLength(1000);

        builder.HasIndex(x => x.PageKey).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
