using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CampaignBookmarkConfiguration : IEntityTypeConfiguration<CampaignBookmark>
{
    public void Configure(EntityTypeBuilder<CampaignBookmark> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.ParticipantId, x.CampaignId }).IsUnique();
        builder.HasIndex(x => x.CampaignId);

        builder.HasOne(x => x.Participant)
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Campaign)
            .WithMany()
            .HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
