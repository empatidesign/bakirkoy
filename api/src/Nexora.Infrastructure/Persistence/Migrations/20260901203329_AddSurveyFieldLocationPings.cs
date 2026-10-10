using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyFieldLocationPings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SurveyFieldLocationPings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InterviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldTaskId = table.Column<Guid>(type: "uuid", nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    AccuracyMeters = table.Column<double>(type: "double precision", nullable: true),
                    SpeedMps = table.Column<double>(type: "double precision", nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DistanceFromPreviousMeters = table.Column<double>(type: "double precision", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyFieldLocationPings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFieldLocationPings_FieldTaskId",
                table: "SurveyFieldLocationPings",
                column: "FieldTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFieldLocationPings_InterviewerId_RecordedAt",
                table: "SurveyFieldLocationPings",
                columns: new[] { "InterviewerId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFieldLocationPings_RecordedAt",
                table: "SurveyFieldLocationPings",
                column: "RecordedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyFieldLocationPings");
        }
    }
}
