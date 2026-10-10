using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Reports;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class ParticipantActivitySyncCursorConfiguration : IEntityTypeConfiguration<ParticipantActivitySyncCursor>
{
    public void Configure(EntityTypeBuilder<ParticipantActivitySyncCursor> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.HasIndex(x => x.Module).IsUnique();
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
