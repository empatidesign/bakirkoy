using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaSettingConfiguration : IEntityTypeConfiguration<SedaSetting>
{
    public void Configure(EntityTypeBuilder<SedaSetting> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.NotificationTemplatesJson).HasColumnType("jsonb").HasDefaultValue("[]");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
