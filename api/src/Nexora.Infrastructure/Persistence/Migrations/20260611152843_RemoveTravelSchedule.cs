using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTravelSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelSchedules");

            migrationBuilder.DropColumn(
                name: "ScheduleCount",
                table: "Travels");

            migrationBuilder.DropColumn(
                name: "ScheduleId",
                table: "TravelApplications");

            migrationBuilder.CreateTable(
                name: "CitizenSubmission",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackingNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CitizenName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CitizenPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CitizenTc = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Neighborhood = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    CategoryId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SubmissionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NotifyMuhtar = table.Column<bool>(type: "boolean", nullable: false),
                    ComplaintReason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PhotoCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SubmittedVia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ForwardedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UlakbelUnit = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    UlakbelTrackingNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CitizenSubmission", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_CategoryId",
                table: "CitizenSubmission",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_Neighborhood",
                table: "CitizenSubmission",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_Priority",
                table: "CitizenSubmission",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_Status",
                table: "CitizenSubmission",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_SubmissionType",
                table: "CitizenSubmission",
                column: "SubmissionType");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmission_SubmittedAt",
                table: "CitizenSubmission",
                column: "SubmittedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CitizenSubmission");

            migrationBuilder.AddColumn<int>(
                name: "ScheduleCount",
                table: "Travels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ScheduleId",
                table: "TravelApplications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TravelSchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CurrentParticipants = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    EndTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    MaxAge = table.Column<int>(type: "integer", nullable: false),
                    MeetingPoint = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    MinAge = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    RequirementsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ReserveCapacity = table.Column<int>(type: "integer", nullable: false),
                    ReturnPoint = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    StartTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelSchedules", x => x.Id);
                });

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
    }
}
