using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelAttendanceConfiguration : IEntityTypeConfiguration<TravelAttendance>
{
    public void Configure(EntityTypeBuilder<TravelAttendance> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Method).IsRequired().HasMaxLength(20);
        builder.Property(x => x.MarkedBy).HasMaxLength(200);

        builder.HasIndex(x => new { x.TravelId, x.ApplicationId }).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
