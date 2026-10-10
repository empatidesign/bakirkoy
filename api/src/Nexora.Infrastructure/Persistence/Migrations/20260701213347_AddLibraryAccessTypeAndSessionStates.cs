using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryAccessTypeAndSessionStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccessType",
                table: "Libraries",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeviceKind",
                table: "Libraries",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(@"UPDATE ""Libraries"" SET ""AccessType"" = CASE WHEN ""DeviceControlEnabled"" = TRUE THEN 'device' ELSE 'qr' END WHERE ""AccessType"" = '';");
            migrationBuilder.Sql(@"UPDATE ""Libraries"" SET ""DeviceKind"" = 'turnstile' WHERE ""AccessType"" = 'device' AND ""DeviceKind"" IS NULL;");

            migrationBuilder.Sql(@"UPDATE ""LibrarySessions"" SET ""Status"" = 'on_break_short' WHERE ""Status"" = 'on_break';");
            migrationBuilder.Sql(@"UPDATE ""LibrarySessions"" SET ""Status"" = 'completed' WHERE ""Status"" = 'exited';");
            migrationBuilder.Sql(@"UPDATE ""LibrarySessions"" SET ""Status"" = 'no_show' WHERE ""Status"" = 'auto_exited';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccessType",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "DeviceKind",
                table: "Libraries");
        }
    }
}
