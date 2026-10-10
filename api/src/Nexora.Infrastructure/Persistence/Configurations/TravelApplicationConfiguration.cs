using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelApplicationConfiguration : IEntityTypeConfiguration<TravelApplication>
{
    public void Configure(EntityTypeBuilder<TravelApplication> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RejectionReason).HasMaxLength(1000);
        builder.Property(x => x.DocumentStatus).IsRequired().HasMaxLength(20);
        builder.Property(x => x.PaymentStatus).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SeatNumber).HasMaxLength(20);
        builder.Property(x => x.Notes).HasColumnType("text");
        builder.Property(x => x.EmergencyContactName).HasMaxLength(150);
        builder.Property(x => x.EmergencyContactPhone).HasMaxLength(20);
        builder.Property(x => x.AppliedBy).HasMaxLength(200);

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => new { x.TravelId, x.Status });
        builder.HasIndex(x => new { x.TravelId, x.ParticipantId })
            .IsUnique()
            .HasFilter("\"ParticipantId\" IS NOT NULL AND \"IsGuest\" = false AND \"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");

        builder.HasMany(x => x.Passengers)
            .WithOne()
            .HasForeignKey(p => p.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
