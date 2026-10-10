using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.StartTime).IsRequired().HasMaxLength(5);
        builder.Property(x => x.EndTime).IsRequired().HasMaxLength(5);
        builder.Property(x => x.Instructor).HasMaxLength(200);
        builder.Property(x => x.InstructorPhone).HasMaxLength(20);
        builder.Property(x => x.InstructorEmail).HasMaxLength(200);
        builder.Property(x => x.EmergencyPhone).HasMaxLength(20);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.SeatStatesJson).HasColumnType("jsonb");

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.EventId);
        builder.HasIndex(x => new { x.HallId, x.Date });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
