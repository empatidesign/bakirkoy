using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MobileQuickActionConfiguration : IEntityTypeConfiguration<MobileQuickAction>
{
    public void Configure(EntityTypeBuilder<MobileQuickAction> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Target).IsRequired().HasMaxLength(64);
        builder.Property(x => x.Label).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Icon).IsRequired().HasMaxLength(64);
        builder.Property(x => x.Color).IsRequired().HasMaxLength(9);
        builder.Property(x => x.TargetUrl).HasMaxLength(1000);

        builder.HasIndex(x => x.SortOrder);
        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasData(MobileQuickActionDefaults.All.Select(s => new
        {
            s.Id,
            s.Target,
            s.Label,
            s.Icon,
            s.Color,
            s.SortOrder,
            IsActive = true,
            s.RequiresAuth,
            s.TargetUrl,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsDeleted = false,
        }));
    }
}
