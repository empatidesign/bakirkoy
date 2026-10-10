using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SedaEducationRecordConfiguration : IEntityTypeConfiguration<SedaEducationRecord>
{
    public void Configure(EntityTypeBuilder<SedaEducationRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AcademicYear).IsRequired().HasMaxLength(9);
        builder.Property(x => x.Score).HasPrecision(6, 2);
        builder.Property(x => x.ResultNote).HasMaxLength(500);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.DetailsJson).HasColumnType("jsonb").HasDefaultValue("{}");

        builder.HasIndex(x => new { x.Tckn, x.AcademicYear }).IsUnique();
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.PeriodId);
        builder.HasIndex(x => new { x.PeriodId, x.Tckn });
        builder.HasIndex(x => new { x.AcademicYear, x.Tckn });
        builder.HasIndex(x => x.Phone);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
