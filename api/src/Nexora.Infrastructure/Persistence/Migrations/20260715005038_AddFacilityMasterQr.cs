using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityMasterQr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MasterCardCodeHash",
                table: "ServiceFacilities",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MasterCardCodeUpdatedAt",
                table: "ServiceFacilities",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MasterQrEnabled",
                table: "ServiceFacilities",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "FacilityMasterAccessLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceFacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Direction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityMasterAccessLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_At",
                table: "FacilityMasterAccessLogs",
                column: "At");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_DeviceId",
                table: "FacilityMasterAccessLogs",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_ServiceFacilityId",
                table: "FacilityMasterAccessLogs",
                column: "ServiceFacilityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FacilityMasterAccessLogs");

            migrationBuilder.DropColumn(
                name: "MasterCardCodeHash",
                table: "ServiceFacilities");

            migrationBuilder.DropColumn(
                name: "MasterCardCodeUpdatedAt",
                table: "ServiceFacilities");

            migrationBuilder.DropColumn(
                name: "MasterQrEnabled",
                table: "ServiceFacilities");
        }
    }
}
