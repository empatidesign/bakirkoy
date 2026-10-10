using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Reports;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantActivityRecordConfiguration : IEntityTypeConfiguration<ParticipantActivityRecord>
{
    public void Configure(EntityTypeBuilder<ParticipantActivityRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.SourceTable).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.ItemName).HasMaxLength(250);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30);
        builder.Property(x => x.IdentityKey).IsRequired().HasMaxLength(60);

        builder.HasIndex(x => new { x.Module, x.SourceId }).IsUnique();

        builder.HasIndex(x => new { x.IdentityKey, x.ActivityDate });
        builder.HasIndex(x => new { x.ParticipantId, x.ActivityDate });
        builder.HasIndex(x => new { x.Module, x.ActivityDate });
        builder.HasIndex(x => x.ActivityDate);

        // P0-4/P0-5 (NEXORA_KAPSAMLI_DENETIM_KONSOLIDE_2026-08-31.md): bu tabloda FK
        // yoktu, ParticipantId sistemde olmayan/yanlış Participant'a işaret edebiliyordu
        // ve 26.726 kayıt hiç bağlanmamıştı. ParticipantId nullable kalıyor (kayıt
        // Participant kaydı silinmeden önce arşivlenmiş olabilir ya da Tckn hiç
        // Participants'ta yoksa gerçekten "yetim" olarak izlenebilsin); Participant
        // silinirse geçmiş aktivite kaydı SetNull ile korunur, tablo sert biçimde
        // silinmez (CampaignRedemptionConfiguration'daki Participant FK deseniyle aynı).
        builder.HasOne<Participant>()
            .WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
