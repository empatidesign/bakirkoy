using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaDefinitionConfiguration : IEntityTypeConfiguration<SedaDefinition>
{
    public void Configure(EntityTypeBuilder<SedaDefinition> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Type).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);

        builder.HasIndex(x => new { x.Type, x.Name }).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
