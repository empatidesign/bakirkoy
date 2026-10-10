using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class LibraryConfiguration : IEntityTypeConfiguration<Library>
{
    public void Configure(EntityTypeBuilder<Library> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.ServiceFacilityName).HasMaxLength(200);
        builder.Property(x => x.City).HasMaxLength(100);
        builder.Property(x => x.District).HasMaxLength(100);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.ManagerName).HasMaxLength(150);
        builder.Property(x => x.ManagerPhone).HasMaxLength(20);
        builder.Property(x => x.ManagerEmail).HasMaxLength(150);
        builder.Property(x => x.ManagerRoleKey).HasMaxLength(100);
        builder.Property(x => x.ManagerRoleName).HasMaxLength(150);
        builder.Property(x => x.EmergencyPhone).HasMaxLength(20);
        builder.Property(x => x.SeatingMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.AreaType).IsRequired().HasMaxLength(20).HasDefaultValue("mixed");
        builder.Property(x => x.AccessType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DeviceKind).HasMaxLength(20);
        builder.Property(x => x.EntryControlMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ExitControlMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.KrokiUrl).HasMaxLength(500);
        builder.Property(x => x.LayoutJson).HasColumnType("jsonb");
        builder.Property(x => x.SeatStatesJson).HasColumnType("jsonb");
        builder.Property(x => x.OperationTemplate).HasMaxLength(30);
        builder.Property(x => x.StaticQrEnabled).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.StaticQrCode).HasMaxLength(64);
        builder.Property(x => x.StaticQrMode).IsRequired().HasMaxLength(20).HasDefaultValue("attendance");
        builder.Property(x => x.StaticQrMinExitSeconds).IsRequired().HasDefaultValue(3);
        builder.Property(x => x.StaticQrReentryCooldownSeconds).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.ResidencyMode).IsRequired().HasMaxLength(20).HasDefaultValue("anyone");

        builder.HasIndex(x => x.Name);
        builder.HasIndex(x => x.ServiceFacilityId);
        builder.HasIndex(x => x.StaticQrCode).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibrarySettingsConfiguration : IEntityTypeConfiguration<LibrarySettings>
{
    public void Configure(EntityTypeBuilder<LibrarySettings> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.SettingsJson).IsRequired().HasColumnType("jsonb");
        builder.HasIndex(x => x.LibraryId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibrarySettingsHistoryConfiguration : IEntityTypeConfiguration<LibrarySettingsHistory>
{
    public void Configure(EntityTypeBuilder<LibrarySettingsHistory> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OldJson).HasColumnType("jsonb");
        builder.Property(x => x.NewJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.ChangedBy).HasMaxLength(200);
        builder.HasIndex(x => new { x.LibraryId, x.CreatedAt });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryRuleConfiguration : IEntityTypeConfiguration<LibraryRule>
{
    public void Configure(EntityTypeBuilder<LibraryRule> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Category).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(1000);
        builder.Property(x => x.Icon).HasMaxLength(16);
        builder.Property(x => x.Severity).IsRequired().HasMaxLength(20);

        builder.HasIndex(x => x.LibraryId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryDeviceConfiguration : IEntityTypeConfiguration<LibraryDevice>
{
    public void Configure(EntityTypeBuilder<LibraryDevice> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Direction).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DeviceId).HasMaxLength(100);
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.Property(x => x.Username).HasMaxLength(100);
        builder.Property(x => x.Password).HasMaxLength(200);
        builder.Property(x => x.WorkMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.HttpPath).HasMaxLength(300);
        builder.Property(x => x.OperationMode).IsRequired().HasMaxLength(20).HasDefaultValue("directional");
        builder.Property(x => x.ToggleCooldownMinutes).HasDefaultValue(5);
        builder.Property(x => x.DeviceCode).IsRequired().HasMaxLength(40);
        builder.Property(x => x.ApiKey).HasMaxLength(200);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.DeviceCode).IsUnique();
        builder.HasIndex(x => x.DeviceId);
        builder.HasIndex(x => x.LibraryId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LibraryLegacyUsageStatConfiguration : IEntityTypeConfiguration<LibraryLegacyUsageStat>
{
    public void Configure(EntityTypeBuilder<LibraryLegacyUsageStat> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.PrimaryLocationName).HasMaxLength(200);
        builder.Property(x => x.ImportBatchId).IsRequired().HasMaxLength(60);
        builder.HasIndex(x => x.Tckn).IsUnique();
        builder.HasIndex(x => x.TotalVisits);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
