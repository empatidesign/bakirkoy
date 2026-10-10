using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantGuardianConfiguration : IEntityTypeConfiguration<ParticipantGuardian>
{
    public void Configure(EntityTypeBuilder<ParticipantGuardian> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Relation).HasMaxLength(50);

        builder.HasIndex(x => new { x.GuardianId, x.ChildId })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");

        builder.HasOne(x => x.Guardian)
            .WithMany(p => p.Children)
            .HasForeignKey(x => x.GuardianId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Child)
            .WithMany(p => p.Guardians)
            .HasForeignKey(x => x.ChildId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
