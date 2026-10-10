using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TopMenuItemConfiguration : IEntityTypeConfiguration<TopMenuItem>
{
    public void Configure(EntityTypeBuilder<TopMenuItem> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.IconType).HasConversion<int>();
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);
        builder.Property(x => x.LinkType).HasConversion<int>();
        builder.Property(x => x.LinkTarget).IsRequired().HasMaxLength(1000);

        builder.HasIndex(x => x.Order);

        // Diğer AppMenu entity'leriyle (MenuItem, MenuSection, SystemModule) tutarlılık
        // için: soft-delete edilen kayıtlar hem admin hem public sorgularından
        // otomatik olarak gizlenmeli. Bu filtre eksikti (P0 bulgu 2026-07-30):
        // silinen bir üst menü öğesi, IsDeleted=true olmasına rağmen herkese açık
        // GET /api/v1/public/top-menu endpoint'inde görünmeye devam ediyordu.
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
