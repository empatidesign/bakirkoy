using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SurveyQuestionConfiguration : IEntityTypeConfiguration<SurveyQuestion>
{
    public void Configure(EntityTypeBuilder<SurveyQuestion> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Type).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Question).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.MinLabel).HasMaxLength(100);
        builder.Property(x => x.MaxLabel).HasMaxLength(100);

        builder.HasIndex(x => x.SurveyId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
