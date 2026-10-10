using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Bakkart;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class BakkartApplicationConfiguration : IEntityTypeConfiguration<BakkartApplication>
{
    public void Configure(EntityTypeBuilder<BakkartApplication> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TrackingNo).IsRequired().HasMaxLength(40);
        builder.Property(x => x.EncryptedFullName).IsRequired();
        builder.Property(x => x.EncryptedTckn).IsRequired();
        builder.Property(x => x.TcknHash).IsRequired().HasMaxLength(100);
        builder.Property(x => x.TcknLast4).IsRequired().HasMaxLength(4);
        builder.Property(x => x.EncryptedPhone).IsRequired();
        builder.Property(x => x.PhoneLast4).IsRequired().HasMaxLength(4);
        builder.Property(x => x.District).IsRequired().HasMaxLength(100);
        builder.Property(x => x.DocumentsJson).HasColumnType("jsonb");
        builder.Property(x => x.RejectReason).HasMaxLength(500);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.ReviewedBy).HasMaxLength(200);

        builder.HasIndex(x => x.TrackingNo).IsUnique();
        builder.HasIndex(x => x.TcknHash);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.AppliedAt);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class BakkartCardConfiguration : IEntityTypeConfiguration<BakkartCard>
{
    public void Configure(EntityTypeBuilder<BakkartCard> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.CardNo).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Balance).HasColumnType("numeric(12,2)");
        builder.Property(x => x.BlockReason).HasMaxLength(500);

        builder.HasIndex(x => x.CardNo).IsUnique();
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.ApplicationId).IsUnique();
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Application)
            .WithMany()
            .HasForeignKey(x => x.ApplicationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Transactions)
            .WithOne()
            .HasForeignKey(t => t.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class BakkartTransactionConfiguration : IEntityTypeConfiguration<BakkartTransaction>
{
    public void Configure(EntityTypeBuilder<BakkartTransaction> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.AmountDelta).HasColumnType("numeric(12,2)");
        builder.Property(x => x.BalanceAfter).HasColumnType("numeric(12,2)");
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.PerformedBy).HasMaxLength(200);

        builder.HasIndex(x => x.CardId);
        builder.HasIndex(x => x.OccurredAt);
        builder.HasIndex(x => x.Type);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
