using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class LibrarySessionConfiguration : IEntityTypeConfiguration<LibrarySession>
{
    public void Configure(EntityTypeBuilder<LibrarySession> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.MemberName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.Seat).HasMaxLength(128);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.PendingAction).HasMaxLength(20);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.Tckn);
        builder.HasIndex(x => new { x.LibraryId, x.Status });
        builder.HasIndex(x => new { x.LibraryId, x.ExitTime }).HasFilter("\"ExitTime\" IS NOT NULL");
        builder.HasIndex(x => x.PendingExitAt).HasFilter("\"PendingExitAt\" IS NOT NULL");
        builder.HasIndex(x => x.ParticipantId, "IX_LibrarySessions_Participant_ActiveUnique")
            .HasFilter("\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" IN ('inside','on_break_short','on_break_long','break_expired','exit_pending')")
            .IsUnique();
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryQueueEntryConfiguration : IEntityTypeConfiguration<LibraryQueueEntry>
{
    public void Configure(EntityTypeBuilder<LibraryQueueEntry> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.QueueNumber).IsRequired().HasMaxLength(20);
        builder.Property(x => x.MemberName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.Method).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => new { x.LibraryId, x.Status });
        builder.HasIndex(x => new { x.LibraryId, x.ParticipantId })
            .HasFilter("\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" IN ('waiting','called')")
            .IsUnique()
            .HasDatabaseName("IX_LibraryQueueEntries_Library_Participant_ActiveUnique");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryBreakConfiguration : IEntityTypeConfiguration<LibraryBreak>
{
    public void Configure(EntityTypeBuilder<LibraryBreak> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.MemberName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Seat).HasMaxLength(128);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.SessionId);
        builder.HasIndex(x => new { x.LibraryId, x.Status });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryReservationConfiguration : IEntityTypeConfiguration<LibraryReservation>
{
    public void Configure(EntityTypeBuilder<LibraryReservation> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.MemberName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.Seat).HasMaxLength(128);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.Tckn);
        builder.HasIndex(x => new { x.LibraryId, x.Status });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
