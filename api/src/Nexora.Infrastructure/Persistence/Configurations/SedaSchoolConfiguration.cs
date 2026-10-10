using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaSchoolConfiguration : IEntityTypeConfiguration<SedaSchool>
{
    public void Configure(EntityTypeBuilder<SedaSchool> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);

        builder.HasIndex(x => x.Name).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
