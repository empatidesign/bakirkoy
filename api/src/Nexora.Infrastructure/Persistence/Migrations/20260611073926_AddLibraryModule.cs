using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Libraries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ServiceFacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceFacilityName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ManagerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ManagerPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ManagerEmail = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ManagerRoleKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ManagerRoleName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SeatingMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    FloorCount = table.Column<int>(type: "integer", nullable: false),
                    IsMultiFloor = table.Column<bool>(type: "boolean", nullable: false),
                    LayoutJson = table.Column<string>(type: "jsonb", nullable: true),
                    KrokiUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    QueueEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReservationEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    EntryControlMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ExitControlMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amenities = table.Column<List<string>>(type: "text[]", nullable: false),
                    IpRestrictionEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AllowedIps = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Libraries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LibrarySettingsRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uuid", nullable: true),
                    SettingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibrarySettingsRecords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_IsActive",
                table: "Libraries",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_Name",
                table: "Libraries",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_ServiceFacilityId",
                table: "Libraries",
                column: "ServiceFacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySettingsRecords_LibraryId",
                table: "LibrarySettingsRecords",
                column: "LibraryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Libraries");

            migrationBuilder.DropTable(
                name: "LibrarySettingsRecords");
        }
    }
}
