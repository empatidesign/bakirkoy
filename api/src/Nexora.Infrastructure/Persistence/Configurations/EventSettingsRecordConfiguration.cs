using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EventSettingsRecordConfiguration : IEntityTypeConfiguration<EventSettingsRecord>
{
    public void Configure(EntityTypeBuilder<EventSettingsRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ConfigJson).IsRequired().HasColumnType("jsonb");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
