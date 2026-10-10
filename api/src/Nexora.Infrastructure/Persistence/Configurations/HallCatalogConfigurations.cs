using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class HallFeatureGroupConfiguration : IEntityTypeConfiguration<HallFeatureGroup>
{
    public void Configure(EntityTypeBuilder<HallFeatureGroup> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.Key).IsUnique();
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class HallFeatureConfiguration : IEntityTypeConfiguration<HallFeature>
{
    public void Configure(EntityTypeBuilder<HallFeature> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).IsRequired().HasMaxLength(80);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(120);
        builder.Property(x => x.GroupKey).IsRequired().HasMaxLength(60);
        builder.HasIndex(x => x.Key).IsUnique();
        builder.HasIndex(x => x.GroupKey);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class HallFeatureTemplateConfiguration : IEntityTypeConfiguration<HallFeatureTemplate>
{
    public void Configure(EntityTypeBuilder<HallFeatureTemplate> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
