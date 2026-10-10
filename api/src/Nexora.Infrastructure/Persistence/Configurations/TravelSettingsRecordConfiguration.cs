using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelSettingsRecordConfiguration : IEntityTypeConfiguration<TravelSettingsRecord>
{
    public void Configure(EntityTypeBuilder<TravelSettingsRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.GeneralJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.ParticipationJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.PaymentJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.RestrictionsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.RulesJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.NotificationTemplatesJson).IsRequired().HasColumnType("jsonb");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
