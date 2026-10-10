using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryStaffParticipantSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.AlterColumn<Guid>(
                name: "AdminUserId",
                table: "LibraryStaffMembers",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<bool>(
                name: "HasDoorAccess",
                table: "LibraryStaffMembers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ParticipantId",
                table: "LibraryStaffMembers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers",
                column: "AdminUserId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"AdminUserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_ParticipantId",
                table: "LibraryStaffMembers",
                column: "ParticipantId",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"ParticipantId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_ParticipantId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "HasDoorAccess",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "ParticipantId",
                table: "LibraryStaffMembers");

            migrationBuilder.AlterColumn<Guid>(
                name: "AdminUserId",
                table: "LibraryStaffMembers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers",
                column: "AdminUserId",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }
    }
}
