using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Popups;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class PopupViewConfiguration : IEntityTypeConfiguration<PopupView>
{
    public void Configure(EntityTypeBuilder<PopupView> builder)
    {
        builder.HasKey(x => x.Id);

        // Bir vatandaşın bir popup kampanyasıyla tek bir "güncel durum" satırı olur.
        builder.HasIndex(x => new { x.PopupCampaignId, x.ParticipantId }).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
