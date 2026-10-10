using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceFacilityModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ServiceFacilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    LocationType = table.Column<int>(type: "integer", nullable: false),
                    OutdoorCategory = table.Column<int>(type: "integer", nullable: true),
                    AreaSizeM2 = table.Column<int>(type: "integer", nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    About = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    ManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Manager = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ManagerPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ManagerEmail = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ManagerRoleKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ManagerRoleName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Website = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Facebook = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Instagram = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Twitter = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    WeekdayOpen = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    WeekdayClose = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    WeekendOpen = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    WeekendClose = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Facilities = table.Column<List<string>>(type: "text[]", nullable: false),
                    AccessibilityFeatures = table.Column<List<string>>(type: "text[]", nullable: false),
                    ParkingCapacity = table.Column<int>(type: "integer", nullable: false),
                    ParkingType = table.Column<int>(type: "integer", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: true),
                    ServiceCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Images = table.Column<string>(type: "jsonb", nullable: true),
                    OfferedServices = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceFacilities", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceFacilities_LocationType",
                table: "ServiceFacilities",
                column: "LocationType");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceFacilities_Name",
                table: "ServiceFacilities",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceFacilities_Status",
                table: "ServiceFacilities",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceFacilities");
        }
    }
}
