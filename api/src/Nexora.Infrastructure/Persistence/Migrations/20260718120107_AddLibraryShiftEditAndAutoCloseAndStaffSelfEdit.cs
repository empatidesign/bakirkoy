using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryShiftEditAndAutoCloseAndStaffSelfEdit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanEditOwnShifts",
                table: "LibraryStaffMembers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoClosedAtCutoff",
                table: "LibraryShifts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "EditReason",
                table: "LibraryShifts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastEditedAt",
                table: "LibraryShifts",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LastEditedById",
                table: "LibraryShifts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastEditedByName",
                table: "LibraryShifts",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OriginalEndTime",
                table: "LibraryShifts",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OriginalStartTime",
                table: "LibraryShifts",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WasEdited",
                table: "LibraryShifts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShifts_StartTime",
                table: "LibraryShifts",
                column: "StartTime");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryShifts_StartTime",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "CanEditOwnShifts",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "AutoClosedAtCutoff",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "EditReason",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "LastEditedAt",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "LastEditedById",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "LastEditedByName",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "OriginalEndTime",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "OriginalStartTime",
                table: "LibraryShifts");

            migrationBuilder.DropColumn(
                name: "WasEdited",
                table: "LibraryShifts");
        }
    }
}
