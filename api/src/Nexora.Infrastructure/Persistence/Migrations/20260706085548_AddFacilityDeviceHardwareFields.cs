using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityDeviceHardwareFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeviceId",
                table: "FacilityDevices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HttpPath",
                table: "FacilityDevices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "FacilityDevices",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Password",
                table: "FacilityDevices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Port",
                table: "FacilityDevices",
                type: "integer",
                nullable: false,
                defaultValue: 80);

            migrationBuilder.AddColumn<int>(
                name: "RelayMs",
                table: "FacilityDevices",
                type: "integer",
                nullable: false,
                defaultValue: 3000);

            migrationBuilder.AddColumn<int>(
                name: "RelayNo",
                table: "FacilityDevices",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<bool>(
                name: "TriggerLockOnSuccess",
                table: "FacilityDevices",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "FacilityDevices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkMode",
                table: "FacilityDevices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "online");


            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_HallId",
                table: "FacilityDevices",
                column: "HallId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropIndex(
                name: "IX_FacilityDevices_HallId",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "DeviceId",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "HttpPath",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "Password",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "Port",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "RelayMs",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "RelayNo",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "TriggerLockOnSuccess",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "Username",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "WorkMode",
                table: "FacilityDevices");
        }
    }
}
