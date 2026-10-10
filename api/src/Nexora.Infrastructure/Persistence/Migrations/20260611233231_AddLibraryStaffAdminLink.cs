using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryStaffAdminLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_Tckn",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "Department",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "Tckn",
                table: "LibraryStaffMembers");

            migrationBuilder.AddColumn<Guid>(
                name: "AdminUserId",
                table: "LibraryStaffMembers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "RoleName",
                table: "LibraryStaffMembers",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers",
                column: "AdminUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "RoleName",
                table: "LibraryStaffMembers");

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "LibraryStaffMembers",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Position",
                table: "LibraryStaffMembers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Tckn",
                table: "LibraryStaffMembers",
                type: "character varying(11)",
                maxLength: 11,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_Tckn",
                table: "LibraryStaffMembers",
                column: "Tckn");
        }
    }
}
