using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyGlobalSettingsAndOptionalThrottle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastOptionalSurveyResponseAt",
                table: "Participants",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OptionalSurveyCounterDay",
                table: "Participants",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OptionalSurveyResponsesToday",
                table: "Participants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "SurveyGlobalSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MaxOptionalResponsesPerDay = table.Column<int>(type: "integer", nullable: false),
                    MinMinutesBetweenOptionalResponses = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyGlobalSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SurveyGlobalSettings",
                columns: new[] { "Id", "CreatedAt", "DeletedAt", "IsDeleted", "MaxOptionalResponsesPerDay", "MinMinutesBetweenOptionalResponses", "UpdatedAt" },
                values: new object[] { new Guid("00000000-0000-0000-0000-00000000507e"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, false, 2, 120, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyGlobalSettings");

            migrationBuilder.DropColumn(
                name: "LastOptionalSurveyResponseAt",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "OptionalSurveyCounterDay",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "OptionalSurveyResponsesToday",
                table: "Participants");
        }
    }
}
