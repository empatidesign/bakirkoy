using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Integrations;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class IntegrationSettingsRecordConfiguration : IEntityTypeConfiguration<IntegrationSettingsRecord>
{
    public void Configure(EntityTypeBuilder<IntegrationSettingsRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ConfigJson).IsRequired().HasColumnType("jsonb");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
