using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SmsSendLogConfiguration : IEntityTypeConfiguration<SmsSendLog>
{
    public void Configure(EntityTypeBuilder<SmsSendLog> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.AdminUserName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Department).HasMaxLength(150);
        builder.Property(x => x.Module).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.BlockReason).HasMaxLength(200);
        builder.Property(x => x.IpAddress).HasMaxLength(50);
        builder.HasQueryFilter(x => !x.IsDeleted);

        // Günlük limit kontrolü (AdminUserId + CreatedAt) ve dashboard sorguları
        // (departman/modül bazlı gruplama + tarih filtreleme) bu indeksleri kullanır.
        builder.HasIndex(x => new { x.AdminUserId, x.CreatedAt });
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.Department);
        builder.HasIndex(x => x.Module);
    }
}
