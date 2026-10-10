using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Facilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ServiceFacilityId = table.Column<Guid>(type: "uuid", nullable: true),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    ManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ManagerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ManagerRoleKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ManagerRoleName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ManagerPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ManagerEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Facilities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    GuardianPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DocumentsJson = table.Column<string>(type: "jsonb", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegistrationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MarkedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    MarkedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityAttendances", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityBranches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PeriodMonths = table.Column<int>(type: "integer", nullable: false),
                    AbsenceLimit = table.Column<int>(type: "integer", nullable: false),
                    ExcuseLimit = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityBranches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Direction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ConnectionModesJson = table.Column<string>(type: "jsonb", nullable: false),
                    DeviceCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ApiKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SerialNo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Gender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    ReserveCapacity = table.Column<int>(type: "integer", nullable: false),
                    AgeMin = table.Column<int>(type: "integer", nullable: false),
                    AgeMax = table.Column<int>(type: "integer", nullable: false),
                    ScheduleJson = table.Column<string>(type: "jsonb", nullable: false),
                    AttendanceMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FeeJson = table.Column<string>(type: "jsonb", nullable: false),
                    ConditionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AbsenceLimit = table.Column<int>(type: "integer", nullable: false),
                    ExcuseLimit = table.Column<int>(type: "integer", nullable: false),
                    RegisteredCount = table.Column<int>(type: "integer", nullable: false),
                    WaitlistCount = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilityRegistrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    GuardianPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    WaitlistOrder = table.Column<int>(type: "integer", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AbsenceUsed = table.Column<int>(type: "integer", nullable: false),
                    ExcuseUsed = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RemovedReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RemovedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityRegistrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilitySessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Day = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    EndTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AttendanceTakenAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsCancelled = table.Column<bool>(type: "boolean", nullable: false),
                    CancelReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilitySessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FacilitySettingsRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Scope = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: true),
                    UseGeneral = table.Column<bool>(type: "boolean", nullable: false),
                    SettingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilitySettingsRecords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_Code",
                table: "Facilities",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_Module",
                table: "Facilities",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_ServiceFacilityId",
                table: "Facilities",
                column: "ServiceFacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_BranchId",
                table: "FacilityApplications",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_FacilityId",
                table: "FacilityApplications",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_GroupId",
                table: "FacilityApplications",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_Module",
                table: "FacilityApplications",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_Status",
                table: "FacilityApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_Tckn",
                table: "FacilityApplications",
                column: "Tckn");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAttendances_GroupId",
                table: "FacilityAttendances",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAttendances_RegistrationId",
                table: "FacilityAttendances",
                column: "RegistrationId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAttendances_SessionId",
                table: "FacilityAttendances",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityBranches_Module",
                table: "FacilityBranches",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_DeviceCode",
                table: "FacilityDevices",
                column: "DeviceCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_FacilityId",
                table: "FacilityDevices",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_Module",
                table: "FacilityDevices",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_BranchId",
                table: "FacilityGroups",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_FacilityId",
                table: "FacilityGroups",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_Module",
                table: "FacilityGroups",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_GroupId",
                table: "FacilityRegistrations",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_Module",
                table: "FacilityRegistrations",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_Status",
                table: "FacilityRegistrations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_Tckn",
                table: "FacilityRegistrations",
                column: "Tckn");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_Date",
                table: "FacilitySessions",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_FacilityId",
                table: "FacilitySessions",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_GroupId_Date",
                table: "FacilitySessions",
                columns: new[] { "GroupId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_Module",
                table: "FacilitySessions",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySettingsRecords_FacilityId",
                table: "FacilitySettingsRecords",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySettingsRecords_Module_Scope",
                table: "FacilitySettingsRecords",
                columns: new[] { "Module", "Scope" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Facilities");

            migrationBuilder.DropTable(
                name: "FacilityApplications");

            migrationBuilder.DropTable(
                name: "FacilityAttendances");

            migrationBuilder.DropTable(
                name: "FacilityBranches");

            migrationBuilder.DropTable(
                name: "FacilityDevices");

            migrationBuilder.DropTable(
                name: "FacilityGroups");

            migrationBuilder.DropTable(
                name: "FacilityRegistrations");

            migrationBuilder.DropTable(
                name: "FacilitySessions");

            migrationBuilder.DropTable(
                name: "FacilitySettingsRecords");
        }
    }
}
