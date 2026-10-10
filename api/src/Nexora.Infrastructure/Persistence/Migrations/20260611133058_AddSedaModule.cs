using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSedaModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SedaApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StudentName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StudentSurname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SchoolName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NextYearGrade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EducationType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExamCenterName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StudentPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ParentPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AppliedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SedaApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SedaDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SedaDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SedaPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    MaxApplications = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SedaPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SedaSchools",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SedaSchools", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SedaSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationsOpen = table.Column<bool>(type: "boolean", nullable: false),
                    RequireApproval = table.Column<bool>(type: "boolean", nullable: false),
                    AutoCloseWhenFull = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SedaSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DocumentStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PaymentStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BusId = table.Column<Guid>(type: "uuid", nullable: true),
                    SeatNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    HasCompanion = table.Column<bool>(type: "boolean", nullable: false),
                    CompanionCount = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    EmergencyContactName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    EmergencyContactPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AppliedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelBuses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PlateNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TemplateId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    DriverName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DriverPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    GuideName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    GuidePhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SeatStatesJson = table.Column<string>(type: "jsonb", nullable: false),
                    OccupiedCount = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelBuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Travels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Destination = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Conditions = table.Column<string>(type: "text", nullable: false),
                    InternalNote = table.Column<string>(type: "text", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    RegistrationStartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    RegistrationEndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Gender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MinAge = table.Column<int>(type: "integer", nullable: false),
                    MaxAge = table.Column<int>(type: "integer", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    ReserveCapacity = table.Column<int>(type: "integer", nullable: false),
                    ParticipationPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ParticipationLimit = table.Column<int>(type: "integer", nullable: false),
                    RestrictionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ImagesJson = table.Column<string>(type: "jsonb", nullable: false),
                    PricingJson = table.Column<string>(type: "jsonb", nullable: false),
                    PointsJson = table.Column<string>(type: "jsonb", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RegisteredCount = table.Column<int>(type: "integer", nullable: false),
                    ReserveCount = table.Column<int>(type: "integer", nullable: false),
                    ScheduleCount = table.Column<int>(type: "integer", nullable: false),
                    BusCount = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_Travels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelSchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    StartTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    EndTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    MeetingPoint = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ReturnPoint = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    ReserveCapacity = table.Column<int>(type: "integer", nullable: false),
                    CurrentParticipants = table.Column<int>(type: "integer", nullable: false),
                    MinAge = table.Column<int>(type: "integer", nullable: false),
                    MaxAge = table.Column<int>(type: "integer", nullable: false),
                    RequirementsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelSchedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelSettingsRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GeneralJson = table.Column<string>(type: "jsonb", nullable: false),
                    ParticipationJson = table.Column<string>(type: "jsonb", nullable: false),
                    PaymentJson = table.Column<string>(type: "jsonb", nullable: false),
                    RestrictionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    RulesJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelSettingsRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TravelApplicationPassengers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Gender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BusId = table.Column<Guid>(type: "uuid", nullable: true),
                    SeatNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelApplicationPassengers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TravelApplicationPassengers_TravelApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "TravelApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RecipientId_CreatedAt",
                table: "Notifications",
                columns: new[] { "RecipientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Code",
                table: "SedaApplications",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_SchoolName",
                table: "SedaApplications",
                column: "SchoolName");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Status",
                table: "SedaApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications",
                column: "Tckn");

            migrationBuilder.CreateIndex(
                name: "IX_SedaDefinitions_Type_Name",
                table: "SedaDefinitions",
                columns: new[] { "Type", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaPeriods_IsActive",
                table: "SedaPeriods",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_SedaPeriods_Name",
                table: "SedaPeriods",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaSchools_Name",
                table: "SedaSchools",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplicationPassengers_ApplicationId",
                table: "TravelApplicationPassengers",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplicationPassengers_BusId_SeatNumber",
                table: "TravelApplicationPassengers",
                columns: new[] { "BusId", "SeatNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_Code",
                table: "TravelApplications",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_ParticipantId",
                table: "TravelApplications",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId",
                table: "TravelApplications",
                column: "TravelId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelBuses_TravelId",
                table: "TravelBuses",
                column: "TravelId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelCategories_Name",
                table: "TravelCategories",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Travels_CategoryId",
                table: "Travels",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Travels_Code",
                table: "Travels",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TravelSchedules_Code",
                table: "TravelSchedules",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TravelSchedules_TravelId",
                table: "TravelSchedules",
                column: "TravelId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "SedaApplications");

            migrationBuilder.DropTable(
                name: "SedaDefinitions");

            migrationBuilder.DropTable(
                name: "SedaPeriods");

            migrationBuilder.DropTable(
                name: "SedaSchools");

            migrationBuilder.DropTable(
                name: "SedaSettings");

            migrationBuilder.DropTable(
                name: "TravelApplicationPassengers");

            migrationBuilder.DropTable(
                name: "TravelBuses");

            migrationBuilder.DropTable(
                name: "TravelCategories");

            migrationBuilder.DropTable(
                name: "Travels");

            migrationBuilder.DropTable(
                name: "TravelSchedules");

            migrationBuilder.DropTable(
                name: "TravelSettingsRecords");

            migrationBuilder.DropTable(
                name: "TravelApplications");
        }
    }
}
