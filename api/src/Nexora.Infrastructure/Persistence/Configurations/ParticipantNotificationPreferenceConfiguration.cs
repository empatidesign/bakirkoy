using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantNotificationPreferenceConfiguration : IEntityTypeConfiguration<ParticipantNotificationPreference>
{
    public void Configure(EntityTypeBuilder<ParticipantNotificationPreference> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Category).HasMaxLength(50).IsRequired();
        builder.Property(x => x.QuietHoursStart).HasMaxLength(5);
        builder.Property(x => x.QuietHoursEnd).HasMaxLength(5);

        builder.HasIndex(x => new { x.ParticipantId, x.Category }).IsUnique();

        builder.HasOne(x => x.Participant)
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
