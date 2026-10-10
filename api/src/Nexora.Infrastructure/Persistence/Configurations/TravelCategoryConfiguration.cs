using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelCategoryConfiguration : IEntityTypeConfiguration<TravelCategory>
{
    public void Configure(EntityTypeBuilder<TravelCategory> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Color).IsRequired().HasMaxLength(20);

        builder.HasIndex(x => x.Name);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
