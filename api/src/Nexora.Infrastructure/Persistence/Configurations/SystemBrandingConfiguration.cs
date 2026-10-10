using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.SystemBranding;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SystemBrandingConfiguration : IEntityTypeConfiguration<SystemBranding>
{
    public void Configure(EntityTypeBuilder<SystemBranding> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.LogoUrl).HasMaxLength(500);
        builder.Property(x => x.LogoObjectName).HasMaxLength(500);
        builder.Property(x => x.HorizontalLogoUrl).HasMaxLength(500);
        builder.Property(x => x.HorizontalLogoObjectName).HasMaxLength(500);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
