using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.TaxNumber).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Address).IsRequired().HasMaxLength(500);
        builder.Property(x => x.District).IsRequired().HasMaxLength(100);
        builder.Property(x => x.PasswordHash).IsRequired().HasMaxLength(200);
        builder.Property(x => x.SecurityVersion).HasDefaultValue(0);
        builder.Property(x => x.Logo).HasMaxLength(500);
        builder.Property(x => x.BannerImage).HasMaxLength(500);
        builder.Property(x => x.BannerImageMobile).HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.Website).HasMaxLength(300);
        builder.Property(x => x.RejectReason).HasMaxLength(500);
        builder.Property(x => x.ApprovedByName).HasMaxLength(200);
        builder.Property(x => x.ServiceDescription).HasMaxLength(5000);
        builder.Property(x => x.GalleryImages).HasColumnType("jsonb");
        builder.Property(x => x.GooglePlaceId).HasMaxLength(300);

        builder.OwnsOne(x => x.SocialMedia, b => b.ToJson());

        builder.HasIndex(x => x.TaxNumber).IsUnique();
        builder.HasIndex(x => x.Phone).IsUnique();
        builder.HasIndex(x => x.Email).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.Name);

        builder.HasOne(x => x.ServiceCategory)
            .WithMany(sc => sc.Companies)
            .HasForeignKey(x => x.ServiceCategoryId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => x.ServiceCategoryId);

        builder.HasMany(x => x.Campaigns)
            .WithOne(c => c.Company)
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
