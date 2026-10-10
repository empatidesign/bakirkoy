using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelApplicationPassengerConfiguration : IEntityTypeConfiguration<TravelApplicationPassenger>
{
    public void Configure(EntityTypeBuilder<TravelApplicationPassenger> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Gender).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SeatNumber).HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);

        builder.HasIndex(x => x.ApplicationId);
        builder.HasIndex(x => new { x.BusId, x.SeatNumber });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
