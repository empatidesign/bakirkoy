using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Team;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TeamNoteConfiguration : IEntityTypeConfiguration<TeamNote>
{
    public void Configure(EntityTypeBuilder<TeamNote> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Content).HasMaxLength(4000);
        builder.Property(x => x.Tone).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => new { x.TargetUserId, x.CreatedAt });
        builder.HasIndex(x => x.AuthorId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class TeamTaskConfiguration : IEntityTypeConfiguration<TeamTask>
{
    public void Configure(EntityTypeBuilder<TeamTask> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => new { x.AssigneeId, x.Status });
        builder.HasIndex(x => x.AssignerId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class TeamMessageConfiguration : IEntityTypeConfiguration<TeamMessage>
{
    public void Configure(EntityTypeBuilder<TeamMessage> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Text).IsRequired().HasMaxLength(4000);
        builder.HasIndex(x => new { x.SenderId, x.RecipientId, x.CreatedAt });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
