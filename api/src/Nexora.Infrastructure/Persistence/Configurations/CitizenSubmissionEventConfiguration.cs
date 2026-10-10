using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CitizenSubmissionEventConfiguration : IEntityTypeConfiguration<CitizenSubmissionEvent>
{
    public void Configure(EntityTypeBuilder<CitizenSubmissionEvent> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.EventType).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Note).HasMaxLength(1000);
        builder.Property(x => x.ActorType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ActorName).HasMaxLength(150);

        builder.HasIndex(x => new { x.SubmissionId, x.OccurredAt });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
