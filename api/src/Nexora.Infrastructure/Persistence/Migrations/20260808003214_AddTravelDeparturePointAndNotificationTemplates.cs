using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelDeparturePointAndNotificationTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NotificationTemplatesJson",
                table: "TravelSettingsRecords",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "DeparturePoint",
                table: "Travels",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeparturePoint",
                table: "TravelRoutes",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificationTemplatesJson",
                table: "TravelSettingsRecords");

            migrationBuilder.DropColumn(
                name: "DeparturePoint",
                table: "Travels");

            migrationBuilder.DropColumn(
                name: "DeparturePoint",
                table: "TravelRoutes");
        }
    }
}
