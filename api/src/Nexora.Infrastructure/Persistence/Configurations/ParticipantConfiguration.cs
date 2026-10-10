using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantConfiguration : IEntityTypeConfiguration<Participant>
{
    public void Configure(EntityTypeBuilder<Participant> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.PhotoUrl).HasMaxLength(500);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.District).HasMaxLength(100);
        builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.Neighborhood).HasMaxLength(150);
        builder.Property(x => x.IlceKodu).HasMaxLength(10);
        builder.Property(x => x.BlockReason).HasMaxLength(500);
        builder.Property(x => x.Email).HasMaxLength(300);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.GuardianEmail).HasMaxLength(300);
        builder.Property(x => x.PasswordHash).IsRequired().HasMaxLength(500);
        builder.Property(x => x.SecurityVersion).HasDefaultValue(0);
        builder.Property(x => x.LastEventName).HasMaxLength(200);
        builder.Property(p => p.AdminNotes).HasMaxLength(2000);
        builder.Property(p => p.AppointmentKey).HasMaxLength(64);

        builder.HasIndex(x => x.Tckn).IsUnique().HasFilter("\"IsDeleted\" = false");
        // Perf (2026-10-06): GetByTcknIncludingDeletedAsync (kayit/giris akisi) IgnoreQueryFilters
        // ile IsDeleted filtresiz arar; partial unique index kullanilamiyor -> 150k satir seq scan.
        builder.HasIndex(x => x.Tckn, "IX_Participants_Tckn_All");
        builder.HasIndex(x => x.AppointmentKey).IsUnique().HasFilter("\"AppointmentKey\" IS NOT NULL");
        builder.HasIndex(x => x.RegisteredAt);
        builder.HasIndex(x => x.Phone);
        builder.HasIndex(x => x.FullName).HasMethod("gin").HasOperators("gin_trgm_ops");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
