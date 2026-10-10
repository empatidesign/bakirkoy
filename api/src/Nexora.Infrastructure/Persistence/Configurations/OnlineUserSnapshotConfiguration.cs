using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Analytics;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class OnlineUserSnapshotConfiguration : IEntityTypeConfiguration<OnlineUserSnapshot>
{
    public void Configure(EntityTypeBuilder<OnlineUserSnapshot> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasQueryFilter(x => !x.IsDeleted);

        // Aynı 5 dakikalık dilim için birden fazla kayıt olmamalı: job birden çok
        // sunucuda/yeniden denemede tetiklense bile tekrar yazmaz.
        builder.HasIndex(x => x.CapturedAt).IsUnique();
    }
}
