using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SurveyGlobalSettingsConfiguration : IEntityTypeConfiguration<SurveyGlobalSettings>
{
    public void Configure(EntityTypeBuilder<SurveyGlobalSettings> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasData(new
        {
            Id = SurveyGlobalSettings.SingletonId,
            MaxOptionalResponsesPerDay = 2,
            MinMinutesBetweenOptionalResponses = 120,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsDeleted = false,
        });
    }
}
