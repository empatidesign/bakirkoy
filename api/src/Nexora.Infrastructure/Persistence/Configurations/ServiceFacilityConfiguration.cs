using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ServiceFacilityConfiguration : IEntityTypeConfiguration<ServiceFacility>
{
    public void Configure(EntityTypeBuilder<ServiceFacility> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.About).HasMaxLength(4000);
        builder.Property(x => x.City).IsRequired().HasMaxLength(100);
        builder.Property(x => x.District).HasMaxLength(100);
        builder.Property(x => x.Address).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Manager).HasMaxLength(150);
        builder.Property(x => x.ManagerPhone).HasMaxLength(20);
        builder.Property(x => x.ManagerEmail).HasMaxLength(150);
        builder.Property(x => x.ManagerRoleKey).HasMaxLength(100);
        builder.Property(x => x.ManagerRoleName).HasMaxLength(150);
        builder.Property(x => x.EmergencyPhone).HasMaxLength(20);
        builder.Property(x => x.Website).HasMaxLength(300);
        builder.Property(x => x.Facebook).HasMaxLength(300);
        builder.Property(x => x.Instagram).HasMaxLength(300);
        builder.Property(x => x.Twitter).HasMaxLength(300);
        builder.Property(x => x.WeekdayOpen).HasMaxLength(5);
        builder.Property(x => x.WeekdayClose).HasMaxLength(5);
        builder.Property(x => x.WeekendOpen).HasMaxLength(5);
        builder.Property(x => x.WeekendClose).HasMaxLength(5);

        builder.Property(x => x.MasterQrEnabled).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.MasterCardCodeHash).HasMaxLength(200);

        builder.OwnsMany(x => x.OfferedServices, b => b.ToJson());
        builder.OwnsMany(x => x.Images, b => b.ToJson());

        builder.HasIndex(x => x.Name);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
