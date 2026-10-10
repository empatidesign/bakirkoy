using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CompanyQrCodeConfiguration : IEntityTypeConfiguration<CompanyQrCode>
{
    public void Configure(EntityTypeBuilder<CompanyQrCode> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.StaticCode).IsRequired().HasMaxLength(32);
        builder.Property(x => x.Purpose).HasMaxLength(200);

        builder.HasIndex(x => x.StaticCode).IsUnique();
        builder.HasIndex(x => x.CompanyId);

        builder.HasOne(x => x.Company)
            .WithMany()
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
