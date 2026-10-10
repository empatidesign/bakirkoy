using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryStaffLocationConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LocationConsentStatus",
                table: "LibraryStaffMembers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unknown");

            migrationBuilder.AddColumn<DateTime>(
                name: "LocationConsentUpdatedAt",
                table: "LibraryStaffMembers",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LocationConsentStatus",
                table: "LibraryStaffMembers");

            migrationBuilder.DropColumn(
                name: "LocationConsentUpdatedAt",
                table: "LibraryStaffMembers");
        }
    }
}
