using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantServiceUsageConfiguration : IEntityTypeConfiguration<ParticipantServiceUsage>
{
    public void Configure(EntityTypeBuilder<ParticipantServiceUsage> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.BranchName).HasMaxLength(200);
        builder.Property(x => x.FacilityName).HasMaxLength(200);
        builder.Property(x => x.Note).HasMaxLength(1000);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);

        builder.HasIndex(x => new { x.Module, x.ParticipantId })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");

        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.Module);

        builder.HasOne<Participant>()
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
