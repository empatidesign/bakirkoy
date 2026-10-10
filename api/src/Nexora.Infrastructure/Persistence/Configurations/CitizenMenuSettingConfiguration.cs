using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.CitizenMenu;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CitizenMenuSettingConfiguration : IEntityTypeConfiguration<CitizenMenuSetting>
{
    public void Configure(EntityTypeBuilder<CitizenMenuSetting> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ItemsJson).IsRequired().HasColumnType("jsonb");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
