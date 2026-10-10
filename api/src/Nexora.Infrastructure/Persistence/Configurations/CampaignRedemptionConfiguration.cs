using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CampaignRedemptionConfiguration : IEntityTypeConfiguration<CampaignRedemption>
{
    public void Configure(EntityTypeBuilder<CampaignRedemption> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.RedemptionCode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.CancelReason).HasMaxLength(500);

        builder.HasIndex(x => x.RedemptionCode).IsUnique();
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.CompanyId);
        builder.HasIndex(x => x.CampaignId);
        builder.HasIndex(x => x.RedeemedAt);

        builder.HasOne(x => x.Participant)
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Company)
            .WithMany()
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Campaign)
            .WithMany()
            .HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
