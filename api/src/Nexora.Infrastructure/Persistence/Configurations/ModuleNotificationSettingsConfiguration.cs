using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ModuleNotificationSettingsConfiguration : IEntityTypeConfiguration<ModuleNotificationSettings>
{
    public void Configure(EntityTypeBuilder<ModuleNotificationSettings> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Module).IsRequired().HasMaxLength(64);
        builder.Property(x => x.ConfigJson).IsRequired().HasColumnType("jsonb");

        builder.HasIndex(x => x.Module).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
