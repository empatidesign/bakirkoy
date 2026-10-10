using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CampaignConfiguration : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.Rules).HasMaxLength(5000);
        builder.Property(x => x.KvkkText).HasMaxLength(10000);
        builder.Property(x => x.ImageUrl).HasMaxLength(1000);
        builder.Property(x => x.DiscountValue).HasPrecision(12, 2);
        builder.Property(x => x.MinOrderAmount).HasPrecision(12, 2);
        builder.Property(x => x.Category).HasConversion<int>();

        builder.HasIndex(x => x.CompanyId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.Category);
        builder.HasIndex(x => x.StartDate);
        builder.HasIndex(x => x.EndDate);

        builder.HasMany(x => x.Products)
            .WithOne(p => p.Campaign)
            .HasForeignKey(p => p.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
