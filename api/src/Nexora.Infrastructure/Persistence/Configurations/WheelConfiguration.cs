using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class WheelConfiguration : IEntityTypeConfiguration<Wheel>
{
    public void Configure(EntityTypeBuilder<Wheel> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.ResidencyMode).IsRequired().HasMaxLength(20).HasDefaultValue("anyone");

        builder.OwnsMany(x => x.Slices, b => b.ToJson());

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
