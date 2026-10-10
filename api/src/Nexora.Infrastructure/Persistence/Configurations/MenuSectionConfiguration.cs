using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MenuSectionConfiguration : IEntityTypeConfiguration<MenuSection>
{
    public void Configure(EntityTypeBuilder<MenuSection> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(80);

        builder.HasIndex(x => x.Key).IsUnique();
        builder.HasIndex(x => x.Order);

        builder.HasMany(x => x.Items)
            .WithOne(x => x.Section)
            .HasForeignKey(x => x.SectionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
