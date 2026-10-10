using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Popups;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class PopupCampaignConfiguration : IEntityTypeConfiguration<PopupCampaign>
{
    public void Configure(EntityTypeBuilder<PopupCampaign> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.TriggerType).IsRequired().HasMaxLength(40);
        builder.Property(x => x.TriggerModuleKey).HasMaxLength(80);

        builder.OwnsMany(x => x.MediaItems, b => b.ToJson());

        builder.HasIndex(x => new { x.IsActive, x.TriggerType });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
