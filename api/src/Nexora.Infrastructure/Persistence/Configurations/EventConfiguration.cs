using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.VenueType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.StartTime).HasMaxLength(5);
        builder.Property(x => x.EndTime).HasMaxLength(5);
        builder.Property(x => x.Gender).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ParticipationPeriod).IsRequired().HasMaxLength(20);

        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.InternalNote).HasColumnType("text");

        builder.Property(x => x.LocationJson).HasColumnType("jsonb");
        builder.Property(x => x.ImagesJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.AccessJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.PricingJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.PointsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.SessionScheduleJson).HasColumnType("jsonb");
        builder.Property(x => x.SeatStatesJson).HasColumnType("jsonb");

        builder.Property(x => x.SultangaziResidentOnly).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.ResidencyMode).IsRequired().HasMaxLength(20).HasDefaultValue("anyone");

        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);

        // Kullanıcı isteği (2026-10-06): Facility/Library'deki sabit QR alanlarıyla aynı yapı.
        builder.Property(x => x.StaticQrEnabled).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.StaticQrCode).HasMaxLength(64);
        builder.Property(x => x.StaticQrMode).IsRequired().HasMaxLength(20).HasDefaultValue("attendance");
        builder.Property(x => x.StaticQrMinExitSeconds).IsRequired().HasDefaultValue(3);
        builder.Property(x => x.StaticQrReentryCooldownSeconds).IsRequired().HasDefaultValue(0);

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.CategoryId);
        builder.HasIndex(x => x.FacilityId).HasFilter("\"FacilityId\" IS NOT NULL");
        builder.HasIndex(x => x.HallId).HasFilter("\"HallId\" IS NOT NULL");
        builder.HasIndex(x => x.StartDate);
        builder.HasIndex(x => x.ApplicationStartDate).HasFilter("\"ApplicationStartDate\" IS NOT NULL");
        builder.HasIndex(x => x.ApplicationEndDate).HasFilter("\"ApplicationEndDate\" IS NOT NULL");
        builder.HasIndex(x => x.StaticQrCode).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
