using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SurveyFieldTaskConfiguration : IEntityTypeConfiguration<SurveyFieldTask>
{
    public void Configure(EntityTypeBuilder<SurveyFieldTask> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Neighborhood).HasMaxLength(100);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.InterviewerType).IsRequired().HasMaxLength(20);

        builder.HasIndex(x => new { x.SurveyId, x.InterviewerId });
        builder.HasIndex(x => x.Neighborhood);

        builder.HasOne<Survey>()
            .WithMany()
            .HasForeignKey(x => x.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class SurveyQuotaConfiguration : IEntityTypeConfiguration<SurveyQuota>
{
    public void Configure(EntityTypeBuilder<SurveyQuota> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Dimension).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Value).IsRequired().HasMaxLength(100);

        builder.HasIndex(x => new { x.SurveyId, x.Dimension, x.Value });

        builder.HasOne<Survey>()
            .WithMany()
            .HasForeignKey(x => x.SurveyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class SurveyQuestionBankItemConfiguration : IEntityTypeConfiguration<SurveyQuestionBankItem>
{
    public void Configure(EntityTypeBuilder<SurveyQuestionBankItem> builder)
    {
        builder.ToTable("SurveyQuestionBank");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Question).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Topic).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Unit).HasMaxLength(150);
        builder.Property(x => x.MinLabel).HasMaxLength(100);
        builder.Property(x => x.MaxLabel).HasMaxLength(100);

        builder.HasIndex(x => x.Topic);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlilerinin GPS izi. Sorgu deseni her zaman
/// "bir anketörün belirli gün aralığındaki ping'leri" olduğu için (InterviewerId, RecordedAt)
/// bileşik indeks kullanılır; canlı harita için tek başına RecordedAt indeksi eklenir.
/// </summary>
public class SurveyFieldLocationPingConfiguration : IEntityTypeConfiguration<SurveyFieldLocationPing>
{
    public void Configure(EntityTypeBuilder<SurveyFieldLocationPing> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.InterviewerId, x.RecordedAt });
        builder.HasIndex(x => x.RecordedAt);
        builder.HasIndex(x => x.FieldTaskId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
