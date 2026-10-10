using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class HallConfiguration : IEntityTypeConfiguration<Hall>
{
    public void Configure(EntityTypeBuilder<Hall> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.FacilityName).HasMaxLength(200);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(50);
        builder.Property(x => x.SeatingMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.About).HasMaxLength(4000);
        builder.Property(x => x.LayoutJson).HasColumnType("jsonb");
        builder.Property(x => x.SeatStatesJson).HasColumnType("jsonb");

        builder.HasIndex(x => x.FacilityId);
        builder.HasIndex(x => x.Name);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
