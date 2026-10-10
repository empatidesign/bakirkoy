using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EventApplicationConfiguration : IEntityTypeConfiguration<EventApplication>
{
    public void Configure(EntityTypeBuilder<EventApplication> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RejectionReason).HasMaxLength(1000);
        builder.Property(x => x.DocumentStatus).IsRequired().HasMaxLength(20);
        builder.Property(x => x.PaymentStatus).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SeatNumber).HasMaxLength(100);
        builder.Property(x => x.AppliedBy).HasMaxLength(200);

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => new { x.SessionId, x.Status, x.CreatedAt });
        builder.HasIndex(x => new { x.EventId, x.Status });

        builder.HasIndex(x => new { x.EventId, x.SessionId, x.ParticipantId })
            .IsUnique()
            .AreNullsDistinct(false)
            .HasFilter("\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected', 'cancelled')")
            .HasDatabaseName("IX_EventApplications_ActiveUnique");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
