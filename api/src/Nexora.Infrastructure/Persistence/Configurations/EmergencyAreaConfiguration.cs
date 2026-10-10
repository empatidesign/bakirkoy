using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.EmergencyAreas;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EmergencyAreaConfiguration : IEntityTypeConfiguration<EmergencyArea>
{
    public void Configure(EntityTypeBuilder<EmergencyArea> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Neighborhood).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Address).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.Manager).HasMaxLength(150);
        builder.Property(x => x.ManagerPhone).HasMaxLength(20);
        builder.Property(x => x.ManagerEmail).HasMaxLength(150);
        builder.Property(x => x.ManagerRoleKey).HasMaxLength(100);
        builder.Property(x => x.ManagerRoleName).HasMaxLength(150);
        builder.Property(x => x.EmergencyPhone).HasMaxLength(20);

        builder.Property(x => x.ExternalSource).HasMaxLength(50);
        builder.HasIndex(x => new { x.ExternalSource, x.ExternalId })
            .IsUnique()
            .HasFilter("\"ExternalSource\" IS NOT NULL");

        builder.OwnsOne(x => x.Equipment, b => b.ToJson());

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
