using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryGeofence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GeofenceEnabled",
                table: "Libraries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "GeofenceLatitude",
                table: "Libraries",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "GeofenceLongitude",
                table: "Libraries",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GeofenceRadiusMeters",
                table: "Libraries",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GeofenceEnabled",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "GeofenceLatitude",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "GeofenceLongitude",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "GeofenceRadiusMeters",
                table: "Libraries");
        }
    }
}
