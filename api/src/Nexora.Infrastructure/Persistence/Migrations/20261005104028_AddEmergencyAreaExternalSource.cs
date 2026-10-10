using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmergencyAreaExternalSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ExternalId",
                table: "EmergencyAreas",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "EmergencyAreas",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExternalSyncedAt",
                table: "EmergencyAreas",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_ExternalSource_ExternalId",
                table: "EmergencyAreas",
                columns: new[] { "ExternalSource", "ExternalId" },
                unique: true,
                filter: "\"ExternalSource\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmergencyAreas_ExternalSource_ExternalId",
                table: "EmergencyAreas");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "EmergencyAreas");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "EmergencyAreas");

            migrationBuilder.DropColumn(
                name: "ExternalSyncedAt",
                table: "EmergencyAreas");
        }
    }
}
