using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.DutyPharmacies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class DutyPharmacyConfiguration : IEntityTypeConfiguration<DutyPharmacy>
{
    public void Configure(EntityTypeBuilder<DutyPharmacy> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.Directions).HasMaxLength(500);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.Neighborhood).HasMaxLength(150);
        builder.Property(x => x.District).IsRequired().HasMaxLength(100);
        builder.Property(x => x.DutyEndTime).HasMaxLength(10);

        builder.HasIndex(x => x.Sicil).IsUnique();
        builder.HasIndex(x => x.DutyDate);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
