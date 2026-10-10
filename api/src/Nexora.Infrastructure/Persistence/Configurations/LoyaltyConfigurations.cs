using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Loyalty;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class LoyaltyRuleConfiguration : IEntityTypeConfiguration<LoyaltyRule>
{
    public void Configure(EntityTypeBuilder<LoyaltyRule> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ActionKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Label).IsRequired().HasMaxLength(120);
        builder.HasIndex(x => x.ActionKey).IsUnique().HasFilter("\"IsDeleted\" = false");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ActionKey).IsRequired().HasMaxLength(60);
        builder.Property(x => x.Label).IsRequired().HasMaxLength(200);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.EarnedAt);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class DailyStreakConfiguration : IEntityTypeConfiguration<DailyStreak>
{
    public void Configure(EntityTypeBuilder<DailyStreak> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.ParticipantId).IsUnique().HasFilter("\"IsDeleted\" = false");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class RewardConfiguration : IEntityTypeConfiguration<Reward>
{
    public void Configure(EntityTypeBuilder<Reward> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.HasIndex(x => x.IsActive);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class RewardRedemptionConfiguration : IEntityTypeConfiguration<RewardRedemption>
{
    public void Configure(EntityTypeBuilder<RewardRedemption> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.RewardName).IsRequired().HasMaxLength(200);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => x.RewardId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
