using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class GiftRequestConfiguration : IEntityTypeConfiguration<GiftRequest>
{
    public void Configure(EntityTypeBuilder<GiftRequest> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.GiftName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.CitizenName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.CitizenTc).HasMaxLength(11);
        builder.Property(x => x.CitizenPhone).HasMaxLength(20);
        builder.Property(x => x.ApprovedBy).HasMaxLength(150);
        builder.Property(x => x.RejectedBy).HasMaxLength(150);
        builder.Property(x => x.RejectReason).HasMaxLength(500);
        builder.Property(x => x.Source).IsRequired().HasMaxLength(20).HasDefaultValue("application");
        builder.Property(x => x.DeliveredBy).HasMaxLength(150);
        builder.Property(x => x.DeliveryNote).HasMaxLength(500);

        builder.HasIndex(x => x.GiftId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CitizenTc);
        builder.HasIndex(x => new { x.ParticipantId, x.Status });
        builder.HasIndex(x => x.RequestedAt);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
