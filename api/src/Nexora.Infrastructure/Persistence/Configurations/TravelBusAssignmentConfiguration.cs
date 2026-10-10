using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelBusAssignmentConfiguration : IEntityTypeConfiguration<TravelBusAssignment>
{
    public void Configure(EntityTypeBuilder<TravelBusAssignment> builder)
    {
        builder.HasKey(x => new { x.TravelId, x.BusId });

        builder.Property(x => x.SeatStatesJson);

        builder.HasOne<Travel>().WithMany().HasForeignKey(x => x.TravelId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<TravelBus>().WithMany().HasForeignKey(x => x.BusId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.BusId);
    }
}
