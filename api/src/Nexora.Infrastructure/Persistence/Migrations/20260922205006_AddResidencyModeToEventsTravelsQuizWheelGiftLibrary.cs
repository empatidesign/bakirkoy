using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddResidencyModeToEventsTravelsQuizWheelGiftLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompanionCount",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "CompanionGender",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "CompanionName",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "CompanionSeatNumber",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "HasCompanion",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "CompanionCount",
                table: "EventApplications");

            migrationBuilder.DropColumn(
                name: "HasCompanion",
                table: "EventApplications");

            migrationBuilder.AddColumn<string>(
                name: "ResidencyMode",
                table: "Wheels",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");

            migrationBuilder.AddColumn<string>(
                name: "ResidencyMode",
                table: "Quizzes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");

            migrationBuilder.AddColumn<string>(
                name: "ResidencyMode",
                table: "Libraries",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");

            migrationBuilder.AddColumn<string>(
                name: "ResidencyMode",
                table: "Gifts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType",
                table: "AuditLogs",
                column: "EntityType");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Module",
                table: "AuditLogs",
                column: "Module");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_EntityType",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_Module",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "ResidencyMode",
                table: "Wheels");

            migrationBuilder.DropColumn(
                name: "ResidencyMode",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "ResidencyMode",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "ResidencyMode",
                table: "Gifts");

            migrationBuilder.AddColumn<int>(
                name: "CompanionCount",
                table: "TravelApplications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CompanionGender",
                table: "TravelApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanionName",
                table: "TravelApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanionSeatNumber",
                table: "TravelApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasCompanion",
                table: "TravelApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CompanionCount",
                table: "EventApplications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "HasCompanion",
                table: "EventApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
