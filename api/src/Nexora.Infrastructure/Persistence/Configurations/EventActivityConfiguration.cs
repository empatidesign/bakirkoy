using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EventActivityConfiguration : IEntityTypeConfiguration<EventActivity>
{
    public void Configure(EntityTypeBuilder<EventActivity> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Kind).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ParticipantName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Method).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).HasMaxLength(40);

        builder.HasIndex(x => x.EventId);
        builder.HasIndex(x => x.At);
        builder.HasIndex(x => new { x.ParticipantId, x.EventId });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
