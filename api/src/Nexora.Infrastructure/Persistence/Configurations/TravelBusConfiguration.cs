using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelBusConfiguration : IEntityTypeConfiguration<TravelBus>
{
    public void Configure(EntityTypeBuilder<TravelBus> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.PlateNumber).HasMaxLength(20);
        builder.Property(x => x.VehicleType).IsRequired().HasMaxLength(20).HasDefaultValue("bus");
        builder.Property(x => x.TemplateId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.SeatStatesJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.CreatedBy).HasMaxLength(200);

        builder.HasIndex(x => x.SourceBusId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
