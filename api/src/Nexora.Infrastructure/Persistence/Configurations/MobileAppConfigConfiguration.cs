using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class MobileAppConfigConfiguration : IEntityTypeConfiguration<MobileAppConfig>
{
    public void Configure(EntityTypeBuilder<MobileAppConfig> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.WebViewUrl).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.WebViewMaxVersion).HasMaxLength(40);
        builder.Property(x => x.WebViewMessage).HasMaxLength(500);
        builder.Property(x => x.AndroidMinVersion).HasMaxLength(40);
        builder.Property(x => x.AndroidLatestVersion).HasMaxLength(40);
        builder.Property(x => x.AndroidStoreUrl).HasMaxLength(1000);
        builder.Property(x => x.IosMinVersion).HasMaxLength(40);
        builder.Property(x => x.IosLatestVersion).HasMaxLength(40);
        builder.Property(x => x.IosStoreUrl).HasMaxLength(1000);
        builder.Property(x => x.UpdateMessage).HasMaxLength(500);
        builder.Property(x => x.UpdateReleaseNotes).HasMaxLength(4000);
        builder.Property(x => x.SplashImageUrl).HasMaxLength(1000);
        builder.Property(x => x.HomeLogoUrl).HasMaxLength(1000);
        builder.Property(x => x.TabBarLogoUrl).HasMaxLength(1000);
        builder.Property(x => x.OnboardingImageUrls).HasColumnType("text[]");
        builder.Property(x => x.CitizenKvkkText).IsRequired().HasMaxLength(20000);
        builder.Property(x => x.CitizenNotificationText).IsRequired().HasMaxLength(10000);
        builder.Property(x => x.CompanyKvkkText).IsRequired().HasMaxLength(20000);
        builder.Property(x => x.CompanyNotificationText).IsRequired().HasMaxLength(10000);
        builder.Property(x => x.CompanyStaffKvkkText).IsRequired().HasMaxLength(20000);
        builder.Property(x => x.CompanyStaffNotificationText).IsRequired().HasMaxLength(10000);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasData(new
        {
            Id = MobileAppConfig.SingletonId,
            WebViewEnabled = false,
            WebViewUrl = string.Empty,
            OnboardingImageUrls = new List<string>(),
            CitizenKvkkText = LegalDocumentDefaults.CitizenKvkk,
            CitizenNotificationText = LegalDocumentDefaults.CitizenNotification,
            CompanyKvkkText = LegalDocumentDefaults.CompanyKvkk,
            CompanyNotificationText = LegalDocumentDefaults.CompanyNotification,
            CompanyStaffKvkkText = LegalDocumentDefaults.CompanyStaffKvkk,
            CompanyStaffNotificationText = LegalDocumentDefaults.CompanyStaffNotification,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            IsDeleted = false,
        });
    }
}
