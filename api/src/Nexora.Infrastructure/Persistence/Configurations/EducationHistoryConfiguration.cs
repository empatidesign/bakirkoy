using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Education;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EducationHistoryConfiguration : IEntityTypeConfiguration<EducationHistory>
{
    public void Configure(EntityTypeBuilder<EducationHistory> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Level).IsRequired();
        builder.Property(x => x.StartYear).IsRequired();
        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasOne(x => x.Participant)
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Institution)
            .WithMany(x => x.EducationHistories)
            .HasForeignKey(x => x.InstitutionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => x.ParticipantId);
    }
}
