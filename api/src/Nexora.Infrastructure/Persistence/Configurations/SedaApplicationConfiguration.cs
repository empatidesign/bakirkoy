using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaApplicationConfiguration : IEntityTypeConfiguration<SedaApplication>
{
    public void Configure(EntityTypeBuilder<SedaApplication> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.StudentName).IsRequired().HasMaxLength(100);
        builder.Property(x => x.StudentSurname).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.SchoolName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.NextYearGrade).HasMaxLength(40);
        builder.Property(x => x.EducationType).HasMaxLength(100);
        builder.Property(x => x.ExamCenterName).HasMaxLength(150);
        builder.Property(x => x.StudentPhone).HasMaxLength(20);
        builder.Property(x => x.ParentPhone).HasMaxLength(20);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.RejectionReason).HasMaxLength(1000);
        builder.Property(x => x.ReviewedBy).HasMaxLength(200);
        builder.Property(x => x.AppliedBy).HasMaxLength(200);
        builder.Property(x => x.CitizenUserId);
        builder.Property(x => x.PeriodId);

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.SchoolName);
        builder.HasIndex(x => new { x.CitizenUserId, x.CreatedAt }).HasFilter("\"CitizenUserId\" IS NOT NULL AND \"IsDeleted\" = false");
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.PeriodId).HasFilter("\"PeriodId\" IS NOT NULL AND \"IsDeleted\" = false");
        // Düzeltme (2026-09-27, kullanıcı bulgusu — SEDA gerçek siteyle karşılaştırma testi):
        // eski tek-kolonlu unique(Tckn) index'i, uygulama katmanındaki dönem-bazlı
        // HasActiveApplicationForTcknAsync düzeltmesini DB seviyesinde geçersiz kılıyordu —
        // bir vatandaş önceki dönemde approved olunca SaveChangesAsync 23505 unique-violation
        // fırlatıp SEDA_ALREADY_APPLIED'e çeviriyordu, yeni döneme asla başvuramıyordu.
        // Artık iki ayrı partial unique index var: (a) PeriodId dolu kayıtlar için (Tckn,PeriodId)
        // bazında benzersizlik — aynı dönemde aynı TCKN'den ikinci aktif başvuru engellenir,
        // farklı dönemde serbesttir; (b) PeriodId null kayıtlar (eski/dönemsiz veri) için eski
        // tek-kolonlu (Tckn) benzersizliği korunur (geriye dönük uyum).
        builder.HasIndex(x => new { x.Tckn, x.PeriodId })
            .IsUnique()
            .HasDatabaseName("IX_SedaApplications_Tckn_PeriodId")
            .HasFilter("\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled') AND \"PeriodId\" IS NOT NULL");
        builder.HasIndex(x => x.Tckn)
            .IsUnique()
            .HasDatabaseName("IX_SedaApplications_Tckn_NoPeriod")
            .HasFilter("\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled') AND \"PeriodId\" IS NULL");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
