using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CompanyOfferingConfiguration : IEntityTypeConfiguration<CompanyOffering>
{
    public void Configure(EntityTypeBuilder<CompanyOffering> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.Category).IsRequired().HasMaxLength(100);
        builder.Property(x => x.MinPrice).HasColumnType("numeric(10,2)");
        builder.Property(x => x.MaxPrice).HasColumnType("numeric(10,2)");
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.HasIndex(x => x.CompanyId);
        builder.HasIndex(x => new { x.CompanyId, x.Category });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
