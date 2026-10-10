using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class LibraryStaffConfiguration : IEntityTypeConfiguration<LibraryStaff>
{
    public void Configure(EntityTypeBuilder<LibraryStaff> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Email).HasMaxLength(150);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.RoleName).HasMaxLength(150);
        builder.Property(x => x.LocationConsentStatus).IsRequired().HasMaxLength(20).HasDefaultValue(Domain.Entities.Libraries.LocationConsentStatus.Unknown);

        builder.HasIndex(x => x.AdminUserId).IsUnique().HasFilter("\"IsDeleted\" = false AND \"AdminUserId\" IS NOT NULL");
        builder.HasIndex(x => x.ParticipantId).IsUnique().HasFilter("\"IsDeleted\" = false AND \"ParticipantId\" IS NOT NULL");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryShiftConfiguration : IEntityTypeConfiguration<LibraryShift>
{
    public void Configure(EntityTypeBuilder<LibraryShift> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.StaffName).IsRequired().HasMaxLength(150);
        builder.Property(x => x.LibraryName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.InitiationType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.InitiatedByName).HasMaxLength(150);
        builder.Property(x => x.Location).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.Property(x => x.LastEditedByName).HasMaxLength(150);
        builder.Property(x => x.EditReason).HasMaxLength(500);

        builder.HasIndex(x => new { x.LibraryId, x.Status });
        builder.HasIndex(x => new { x.StaffId, x.StartTime });
        builder.HasIndex(x => new { x.IpAddress, x.Status });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
