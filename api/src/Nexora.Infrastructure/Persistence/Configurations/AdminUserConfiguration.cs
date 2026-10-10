using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class AdminUserConfiguration : IEntityTypeConfiguration<AdminUser>
{
    public void Configure(EntityTypeBuilder<AdminUser> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Email).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.Department).HasMaxLength(100);
        builder.Property(x => x.PasswordHash).IsRequired().HasMaxLength(500);
        builder.Property(x => x.SecurityVersion).HasDefaultValue(0);
        builder.Property(x => x.TwoFactorChannel).HasMaxLength(10);
        builder.Property(x => x.LastLoginIp).HasMaxLength(50);

        // NOT (2026-09-05, gerçek testte bulunan bug): filtresiz unique index, soft-delete
        // edilmiş (IsDeleted=true) bir kullanıcının email'ini KALICI OLARAK bloke ediyordu —
        // örn. bir muhtar/personel hesabı silinip aynı email'le (mahalle adına dayalı otomatik
        // üretilen, örn. muhtar.cebeci@sultangazi.bel.tr) yeniden oluşturulmaya çalışıldığında
        // Postgres 23505 (unique violation) → DUPLICATE_RECORD hatası veriyordu. `EnsureUserAsync`
        // (ScopedStaffService) `GetByEmailAsync` ile arıyor ki bu EF query filter nedeniyle
        // soft-deleted kayıtları GÖRMÜYOR, dolayısıyla "yeni kullanıcı" oluşturmaya çalışıyor
        // ve DB seviyesinde çakışıyordu. Diğer entity'lerdeki (Department, EventCategory, vb.)
        // "IsDeleted = false" filtreli unique index deseniyle tutarlı hale getirildi.
        builder.HasIndex(x => x.Email).IsUnique().HasFilter("\"IsDeleted\" = false");
        builder.HasIndex(x => x.RoleId);

        // SultanŞehir Anket Platformu — anket-özel yetki alanları (doküman 07 §9: Anketör rolü,
        // yalnızca kendi verisini gören dar kapsamlı "Anket Kullanıcısı" yetkisi).
        builder.PrimitiveCollection(x => x.SurveyNeighborhoods).HasColumnType("text[]");

        builder.HasOne<Role>()
            .WithMany()
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
