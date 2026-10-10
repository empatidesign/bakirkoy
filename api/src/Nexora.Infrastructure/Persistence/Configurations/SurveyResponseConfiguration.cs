using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SurveyResponseConfiguration : IEntityTypeConfiguration<SurveyResponse>
{
    public void Configure(EntityTypeBuilder<SurveyResponse> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.CitizenTc).IsRequired().HasMaxLength(64);
        builder.Property(x => x.AnswersJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.Channel).IsRequired().HasMaxLength(20);
        builder.Property(x => x.InterviewerType).HasMaxLength(20);
        builder.Property(x => x.Neighborhood).HasMaxLength(100);
        builder.Property(x => x.DeviceId).HasMaxLength(100);
        builder.Property(x => x.AgeGroup).HasMaxLength(10);
        builder.Property(x => x.Gender).HasMaxLength(10);
        builder.Property(x => x.FlagReason).HasMaxLength(200);
        builder.Property(x => x.LocalUuid).HasMaxLength(64);

        builder.HasIndex(x => x.Neighborhood);
        builder.HasIndex(x => x.InterviewerId);
        // Offline senkron idempotency (doküman 06 §5): aynı local_uuid iki kez işlenemez.
        builder.HasIndex(x => x.LocalUuid).IsUnique().HasFilter("\"LocalUuid\" IS NOT NULL AND \"IsDeleted\" = false");

        builder.HasIndex(x => new { x.SurveyId, x.CitizenTc }).HasFilter("\"IsDeleted\" = false");

        builder.HasOne<Survey>()
            .WithMany()
            .HasForeignKey(x => x.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
