using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Body).IsRequired().HasMaxLength(2000);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(40);

        builder.HasIndex(x => new { x.RecipientId, x.CreatedAt });

        // Kullanıcı isteği (2026-09-01): onay bekleyen duyurular her uygulama
        // açılışında sorgulanıyor; filtrelenmiş indeks bu sorguyu tablo boyutundan
        // bağımsız kılar (bekleyen kayıt sayısı her zaman çok küçük).
        builder.HasIndex(x => new { x.RecipientId, x.AcknowledgedAt })
            .HasFilter("\"RequiresAck\" = true AND \"AcknowledgedAt\" IS NULL");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
