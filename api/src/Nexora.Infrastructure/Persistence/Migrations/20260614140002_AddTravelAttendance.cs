using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AttendanceReminderSentAt",
                table: "Travels",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttendanceTakenAt",
                table: "Travels",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TravelAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_TravelAttendances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TravelAttendances_TravelId",
                table: "TravelAttendances",
                column: "TravelId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelAttendances_TravelId_ApplicationId",
                table: "TravelAttendances",
                columns: new[] { "TravelId", "ApplicationId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelAttendances");

            migrationBuilder.DropColumn(
                name: "AttendanceReminderSentAt",
                table: "Travels");

            migrationBuilder.DropColumn(
                name: "AttendanceTakenAt",
                table: "Travels");
        }
    }
}
