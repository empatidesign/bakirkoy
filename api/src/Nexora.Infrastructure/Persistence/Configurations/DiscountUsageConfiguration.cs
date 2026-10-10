using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class DiscountUsageConfiguration : IEntityTypeConfiguration<DiscountUsage>
{
    public void Configure(EntityTypeBuilder<DiscountUsage> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.UserName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.UserPhone).HasMaxLength(20);
        builder.Property(x => x.DiscountCode).IsRequired().HasMaxLength(50);
        builder.Property(x => x.OrderAmount).HasPrecision(12, 2);
        builder.Property(x => x.CancelReason).HasMaxLength(500);

        builder.HasIndex(x => x.CompanyId);
        builder.HasIndex(x => x.CampaignId);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Campaign)
            .WithMany()
            .HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
