using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CitizenSubmissionConfiguration : IEntityTypeConfiguration<CitizenSubmission>
{
    public void Configure(EntityTypeBuilder<CitizenSubmission> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.TrackingNo).HasMaxLength(40);
        builder.Property(x => x.CitizenName).IsRequired().HasMaxLength(150);
        builder.Property(x => x.CitizenPhone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.CitizenTc).IsRequired().HasMaxLength(11);
        builder.Property(x => x.CitizenBirthDate);
        builder.Property(x => x.Neighborhood).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Address).IsRequired().HasMaxLength(500);
        builder.Property(x => x.CategoryId).IsRequired().HasMaxLength(40);
        builder.Property(x => x.SubmissionType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Priority).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ComplaintReason).HasMaxLength(40);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(250);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(2000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SubmittedVia).IsRequired().HasMaxLength(20);
        builder.Property(x => x.UlakbelUnit).HasMaxLength(150);
        builder.Property(x => x.UlakbelTrackingNo).HasMaxLength(40);
        builder.Property(x => x.UlakbelForwardState).HasMaxLength(20);
        builder.Property(x => x.MediaUrls).HasColumnType("jsonb");

        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CategoryId);
        builder.HasIndex(x => x.SubmittedAt);
        builder.HasIndex(x => x.CitizenTc);
        builder.HasIndex(x => new { x.Neighborhood, x.SubmittedAt });
        // #21 fix: TrackingNo esZamanli basvurularda cakisiyordu, artik unique.
        // NOT: Uretim DB'sinde bu index eklenmeden once mevcut cakisan kayitlarin
        // (bkz. migration yorumu) temizlenmesi/backfill edilmesi gerekiyor.
        builder.HasIndex(x => x.TrackingNo).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
