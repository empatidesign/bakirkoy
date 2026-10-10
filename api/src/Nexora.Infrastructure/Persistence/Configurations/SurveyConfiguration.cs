using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SurveyConfiguration : IEntityTypeConfiguration<Survey>
{
    public void Configure(EntityTypeBuilder<Survey> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Category).HasMaxLength(100);
        builder.Property(x => x.TargetAudience).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SourceType).HasMaxLength(20);
        builder.Property(x => x.SurveyType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.IdentityMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Topic).HasMaxLength(100);

        builder.HasIndex(x => x.Topic);

        builder.HasIndex(x => new { x.SourceType, x.SourceId });

        builder.HasMany(x => x.Questions)
            .WithOne()
            .HasForeignKey(q => q.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
