using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryDeviceToggleMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OperationMode",
                table: "LibraryDevices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "directional");

            migrationBuilder.AddColumn<int>(
                name: "ToggleCooldownMinutes",
                table: "LibraryDevices",
                type: "integer",
                nullable: false,
                defaultValue: 5);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OperationMode",
                table: "LibraryDevices");

            migrationBuilder.DropColumn(
                name: "ToggleCooldownMinutes",
                table: "LibraryDevices");
        }
    }
}
