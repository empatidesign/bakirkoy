using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class FacilityMasterAccessLogConfiguration : IEntityTypeConfiguration<FacilityMasterAccessLog>
{
    public void Configure(EntityTypeBuilder<FacilityMasterAccessLog> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DeviceCode).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Direction).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Method).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.DeviceId);
        builder.HasIndex(x => new { x.ServiceFacilityId, x.At });
    }
}
