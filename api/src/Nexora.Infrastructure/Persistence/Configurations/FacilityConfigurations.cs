using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    public void Configure(EntityTypeBuilder<Facility> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Kind).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ManagerName).HasMaxLength(200);
        builder.Property(x => x.ManagerRoleKey).HasMaxLength(100);
        builder.Property(x => x.ManagerRoleName).HasMaxLength(150);
        builder.Property(x => x.ManagerPhone).HasMaxLength(20);
        builder.Property(x => x.ManagerEmail).HasMaxLength(200);
        builder.Property(x => x.EmergencyPhone).HasMaxLength(20);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.Property(x => x.StaticQrEnabled).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.StaticQrCode).HasMaxLength(64);
        builder.Property(x => x.StaticQrMode).IsRequired().HasMaxLength(20).HasDefaultValue("attendance");
        builder.Property(x => x.StaticQrMinExitSeconds).IsRequired().HasDefaultValue(3);
        builder.Property(x => x.StaticQrReentryCooldownSeconds).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.SortOrder).IsRequired().HasDefaultValue(0);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.ServiceFacilityId);
        builder.HasIndex(x => x.StaticQrCode).IsUnique();
        builder.HasIndex(x => new { x.Module, x.SortOrder });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityBranchConfiguration : IEntityTypeConfiguration<FacilityBranch>
{
    public void Configure(EntityTypeBuilder<FacilityBranch> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Category).HasMaxLength(100).HasDefaultValue("");
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.Module);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityGroupConfiguration : IEntityTypeConfiguration<FacilityGroup>
{
    public void Configure(EntityTypeBuilder<FacilityGroup> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Gender).IsRequired().HasMaxLength(20);
        builder.Property(x => x.AttendanceMode).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ScheduleJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.FeeJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.ConditionsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.InstructorName).HasMaxLength(200);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.Property(x => x.AutoApprove).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.AttendanceLimitOverride).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.AttendanceLimitType).IsRequired().HasMaxLength(20).HasDefaultValue("unlimited");
        builder.Property(x => x.AttendanceLimitCount).IsRequired().HasDefaultValue(0);
        builder.Property(x => x.AcademyWhitelistTcknsJson).IsRequired().HasColumnType("jsonb").HasDefaultValue("[]");
        builder.Property(x => x.ResidencyMode).IsRequired().HasMaxLength(20).HasDefaultValue("anyone");
        builder.Property(x => x.EntitlementModel).IsRequired().HasMaxLength(30).HasDefaultValue("fixed_calendar");
        builder.Property(x => x.SortOrder).IsRequired().HasDefaultValue(0);
        builder.HasIndex(x => new { x.Module, x.IsActive });
        builder.HasIndex(x => x.FacilityId);
        builder.HasIndex(x => x.BranchId);
        builder.HasIndex(x => x.ParentGroupId);
        builder.HasIndex(x => x.InstructorId);
        builder.HasIndex(x => new { x.FacilityId, x.ParentGroupId, x.SortOrder });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilitySessionConfiguration : IEntityTypeConfiguration<FacilitySession>
{
    public void Configure(EntityTypeBuilder<FacilitySession> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Day).IsRequired().HasMaxLength(20);
        builder.Property(x => x.StartTime).IsRequired().HasMaxLength(10);
        builder.Property(x => x.EndTime).IsRequired().HasMaxLength(10);
        builder.Property(x => x.CancelReason).HasMaxLength(500);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => new { x.GroupId, x.Date });
        builder.HasIndex(x => new { x.FacilityId, x.Date });
        // Perf (2026-10-06): FacilityAttendanceDeadlineJob her dakika bekleyen yoklamalari
        // (iptal degil, yoklamasi alinmamis, Date <= bugun) ariyordu -> tum tabloda seq scan.
        builder.HasIndex(x => x.Date)
            .HasFilter("\"AttendanceTakenAt\" IS NULL AND \"IsCancelled\" = false AND \"IsDeleted\" = false")
            .HasDatabaseName("IX_FacilitySessions_PendingAttendance_Date");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityApplicationConfiguration : IEntityTypeConfiguration<FacilityApplication>
{
    public void Configure(EntityTypeBuilder<FacilityApplication> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.Gender).HasMaxLength(10);
        builder.Property(x => x.DocumentsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.CustomAnswersJson).IsRequired().HasColumnType("jsonb").HasDefaultValue("{}");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RejectReason).HasMaxLength(500);
        builder.Property(x => x.ReviewedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.BranchId);
        builder.HasIndex(x => x.GroupId);
        builder.HasIndex(x => x.Tckn);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasIndex(x => new { x.FacilityId, x.Status });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityRegistrationConfiguration : IEntityTypeConfiguration<FacilityRegistration>
{
    public void Configure(EntityTypeBuilder<FacilityRegistration> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.GuardianPhone).HasMaxLength(20);
        builder.Property(x => x.Kind).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.RemovedReason).HasMaxLength(500);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.GroupId);
        builder.HasIndex(x => x.Tckn);
        builder.HasIndex(x => x.FacilityId);
        builder.HasIndex(x => x.ApplicationId);
        builder.HasIndex(x => new { x.GroupId, x.Tckn })
            .HasFilter("\"Status\" = 'active' AND \"IsDeleted\" = false")
            .IsUnique()
            .HasDatabaseName("IX_FacilityRegistrations_GroupId_Tckn_ActiveUnique");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityAttendanceConfiguration : IEntityTypeConfiguration<FacilityAttendance>
{
    public void Configure(EntityTypeBuilder<FacilityAttendance> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Method).IsRequired().HasMaxLength(20);
        builder.Property(x => x.MarkedBy).HasMaxLength(200);
        builder.HasIndex(x => x.SessionId);
        builder.HasIndex(x => x.GroupId);
        builder.HasIndex(x => x.RegistrationId);
        // Perf (2026-10-06): anket kitle kontrolu (facility_attendees) ParticipantId [+FacilityId]
        // ile EXISTS atiyor; index yoktu -> 226k satirlik seq scan (70 sn'de 99 kez olculdu).
        builder.HasIndex(x => new { x.ParticipantId, x.FacilityId });
        builder.HasIndex(x => new { x.SessionId, x.RegistrationId })
            .HasFilter("\"RegistrationId\" IS NOT NULL AND \"IsDeleted\" = false")
            .IsUnique()
            .HasDatabaseName("IX_FacilityAttendances_Session_Registration_ActiveUnique");
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityDeviceConfiguration : IEntityTypeConfiguration<FacilityDevice>
{
    public void Configure(EntityTypeBuilder<FacilityDevice> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Scope).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Direction).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Kind).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ConnectionModesJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.DeviceCode).IsRequired().HasMaxLength(40);
        builder.Property(x => x.ApiKey).HasMaxLength(200);
        builder.Property(x => x.SerialNo).HasMaxLength(100);
        builder.Property(x => x.WebhookUrl).HasMaxLength(500);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.Property(x => x.DeviceId).HasMaxLength(100);
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.Property(x => x.Username).HasMaxLength(100);
        builder.Property(x => x.Password).HasMaxLength(200);
        builder.Property(x => x.WorkMode).IsRequired().HasMaxLength(20).HasDefaultValue("online");
        builder.Property(x => x.HttpPath).HasMaxLength(200);
        builder.HasIndex(x => x.DeviceCode).IsUnique();
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.FacilityId);
        builder.HasIndex(x => x.ServiceFacilityId);
        builder.HasIndex(x => x.SerialNo);
        builder.HasIndex(x => x.HallId);
        builder.HasIndex(x => x.GroupId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilitySettingsRecordConfiguration : IEntityTypeConfiguration<FacilitySettingsRecord>
{
    public void Configure(EntityTypeBuilder<FacilitySettingsRecord> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Scope).IsRequired().HasMaxLength(20);
        builder.Property(x => x.SettingsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.HasIndex(x => new { x.Module, x.Scope });
        builder.HasIndex(x => x.FacilityId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class FacilityInstructorConfiguration : IEntityTypeConfiguration<FacilityInstructor>
{
    public void Configure(EntityTypeBuilder<FacilityInstructor> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Module).IsRequired().HasMaxLength(30);
        builder.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).HasMaxLength(11);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Specialty).HasMaxLength(200);
        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);
        builder.Property(x => x.DeletedBy).HasMaxLength(200);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.UserId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class AccessibleApplicationDetailConfiguration : IEntityTypeConfiguration<AccessibleApplicationDetail>
{
    public void Configure(EntityTypeBuilder<AccessibleApplicationDetail> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PrimaryDisabilityType).HasMaxLength(30);
        builder.Property(x => x.EmergencyContactName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.EmergencyContactPhone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.KvkkConsentVersion).HasMaxLength(20);
        // Bir başvurunun yalnızca tek bir engellilik-bilgisi kaydı olabilir.
        builder.HasIndex(x => x.FacilityApplicationId).IsUnique();
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class AccessibleProgressNoteConfiguration : IEntityTypeConfiguration<AccessibleProgressNote>
{
    public void Configure(EntityTypeBuilder<AccessibleProgressNote> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.NoteType).IsRequired().HasMaxLength(50);
        builder.Property(x => x.RecommendedAdjustments).HasMaxLength(1000);
        builder.Property(x => x.RecordedBy).IsRequired().HasMaxLength(200);
        builder.HasIndex(x => x.FacilityApplicationId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class AccessibleCaregiverConfiguration : IEntityTypeConfiguration<AccessibleCaregiver>
{
    public void Configure(EntityTypeBuilder<AccessibleCaregiver> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.Phone).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Relation).IsRequired().HasMaxLength(20);
        builder.HasIndex(x => x.ParticipantId);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
