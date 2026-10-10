using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameStaticQrTimingToSeconds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StaticQrMinExitMinutes",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrReentryCooldownMinutes",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrMinExitMinutes",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StaticQrReentryCooldownMinutes",
                table: "Facilities");

            migrationBuilder.AddColumn<int>(
                name: "StaticQrMinExitSeconds",
                table: "Libraries",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrReentryCooldownSeconds",
                table: "Libraries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrMinExitSeconds",
                table: "Facilities",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrReentryCooldownSeconds",
                table: "Facilities",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StaticQrMinExitSeconds",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrReentryCooldownSeconds",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrMinExitSeconds",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StaticQrReentryCooldownSeconds",
                table: "Facilities");

            migrationBuilder.AddColumn<int>(
                name: "StaticQrMinExitMinutes",
                table: "Libraries",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrReentryCooldownMinutes",
                table: "Libraries",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrMinExitMinutes",
                table: "Facilities",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrReentryCooldownMinutes",
                table: "Facilities",
                type: "integer",
                nullable: false,
                defaultValue: 5);
        }
    }
}
