using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmergencyAreaModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmergencyAreas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Neighborhood = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    AreaSizeM2 = table.Column<int>(type: "integer", nullable: false),
                    ManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Manager = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ManagerPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ManagerEmail = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ManagerRoleKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ManagerRoleName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Equipment = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmergencyAreas", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Name",
                table: "EmergencyAreas",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Neighborhood",
                table: "EmergencyAreas",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Status",
                table: "EmergencyAreas",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmergencyAreas");
        }
    }
}
