using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.UserName).HasMaxLength(200);
        builder.Property(x => x.UserRole).HasMaxLength(100);
        builder.Property(x => x.Module).HasMaxLength(100);
        builder.Property(x => x.IpAddress).HasMaxLength(50);
        builder.Property(x => x.UserAgent).HasMaxLength(500);
        builder.Property(x => x.SessionId).HasMaxLength(200);
        builder.HasQueryFilter(x => !x.IsDeleted);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.EntityId);
        builder.HasIndex(x => x.Action);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.EntityType);
    }
}
