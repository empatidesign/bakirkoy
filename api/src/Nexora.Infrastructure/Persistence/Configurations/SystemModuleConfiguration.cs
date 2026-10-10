using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SystemModuleConfiguration : IEntityTypeConfiguration<SystemModule>
{
    public void Configure(EntityTypeBuilder<SystemModule> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Label).IsRequired().HasMaxLength(120);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(80);
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);
        builder.Property(x => x.CitizenRoute).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AdminRoute).IsRequired().HasMaxLength(200);

        // Key benzersizligi HasPrincipalKey'in olusturdugu AK_SystemModules_Key ile saglanir;
        // ayri unique IX mukerrerdi (2026-10-06 perf temizligi).
        builder.HasIndex(x => x.AdminSidebarOrder);

        builder.HasMany(x => x.MenuItems)
            .WithOne(x => x.Module)
            .HasForeignKey(x => x.ModuleKey)
            .HasPrincipalKey(x => x.Key)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
