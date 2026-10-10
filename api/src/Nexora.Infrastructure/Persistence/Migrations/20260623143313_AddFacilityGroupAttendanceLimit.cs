using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityGroupAttendanceLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AttendanceLimitCount",
                table: "FacilityGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "AttendanceLimitOverride",
                table: "FacilityGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AttendanceLimitType",
                table: "FacilityGroups",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unlimited");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttendanceLimitCount",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "AttendanceLimitOverride",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "AttendanceLimitType",
                table: "FacilityGroups");
        }
    }
}
