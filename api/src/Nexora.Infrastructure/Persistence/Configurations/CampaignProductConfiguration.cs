using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CampaignProductConfiguration : IEntityTypeConfiguration<CampaignProduct>
{
    public void Configure(EntityTypeBuilder<CampaignProduct> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ImageUrl).HasMaxLength(1000);
        builder.Property(x => x.Price).HasPrecision(12, 2);

        builder.HasIndex(x => x.CampaignId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
