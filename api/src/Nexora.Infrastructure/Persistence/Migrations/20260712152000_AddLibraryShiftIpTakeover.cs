using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryShiftIpTakeover : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "LibraryShifts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EndedByIpTakeover",
                table: "LibraryShifts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShifts_IpAddress_Status",
                table: "LibraryShifts",
                columns: new[] { "IpAddress", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryShifts_IpAddress_Status",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "EndedByIpTakeover",
                table: "LibraryShifts");
        }
    }
}
