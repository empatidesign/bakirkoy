using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantDevicePermissionConfiguration : IEntityTypeConfiguration<ParticipantDevicePermission>
{
    public void Configure(EntityTypeBuilder<ParticipantDevicePermission> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.LocationStatus).HasMaxLength(20).IsRequired();
        builder.Property(x => x.NotificationStatus).HasMaxLength(20).IsRequired();
        builder.Property(x => x.PushToken).HasMaxLength(512);
        builder.Property(x => x.DevicePlatform).HasMaxLength(20);

        builder.HasIndex(x => x.ParticipantId).IsUnique();

        builder.HasOne(x => x.Participant)
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
