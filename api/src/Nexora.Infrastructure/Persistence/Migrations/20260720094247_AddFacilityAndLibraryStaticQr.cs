using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityAndLibraryStaticQr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StaticQrCode",
                table: "Libraries",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StaticQrEnabled",
                table: "Libraries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StaticQrMode",
                table: "Libraries",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "attendance");

            migrationBuilder.AddColumn<string>(
                name: "StaticQrCode",
                table: "Facilities",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StaticQrEnabled",
                table: "Facilities",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StaticQrMode",
                table: "Facilities",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "attendance");

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_StaticQrCode",
                table: "Libraries",
                column: "StaticQrCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_StaticQrCode",
                table: "Facilities",
                column: "StaticQrCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Libraries_StaticQrCode",
                table: "Libraries");

            migrationBuilder.DropIndex(
                name: "IX_Facilities_StaticQrCode",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StaticQrCode",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrEnabled",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrMode",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "StaticQrCode",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StaticQrEnabled",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "StaticQrMode",
                table: "Facilities");
        }
    }
}
