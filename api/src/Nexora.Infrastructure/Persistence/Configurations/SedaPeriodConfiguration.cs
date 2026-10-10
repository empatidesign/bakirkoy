using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaPeriodConfiguration : IEntityTypeConfiguration<SedaPeriod>
{
    public void Configure(EntityTypeBuilder<SedaPeriod> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Description).HasMaxLength(500);

        builder.HasIndex(x => x.Name).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
