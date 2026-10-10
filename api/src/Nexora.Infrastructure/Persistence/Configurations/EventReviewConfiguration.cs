using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Reviews;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EventReviewConfiguration : IEntityTypeConfiguration<EventReview>
{
    public void Configure(EntityTypeBuilder<EventReview> builder)
    {
        builder.HasKey(r => r.Id);
        builder.HasIndex(r => new { r.EventId, r.ParticipantId }).IsUnique();
        builder.Property(r => r.Comment).HasMaxLength(1000);
        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}
