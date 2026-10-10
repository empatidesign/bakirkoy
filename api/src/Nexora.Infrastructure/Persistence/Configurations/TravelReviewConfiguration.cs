using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Reviews;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelReviewConfiguration : IEntityTypeConfiguration<TravelReview>
{
    public void Configure(EntityTypeBuilder<TravelReview> builder)
    {
        builder.HasKey(r => r.Id);
        builder.HasIndex(r => new { r.TravelId, r.ParticipantId }).IsUnique();
        builder.Property(r => r.Comment).HasMaxLength(1000);
        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}
