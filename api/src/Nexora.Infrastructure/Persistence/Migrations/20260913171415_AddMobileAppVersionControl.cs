using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileAppVersionControl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AndroidLatestVersion",
                table: "MobileAppConfigs",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AndroidMinVersion",
                table: "MobileAppConfigs",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AndroidStoreUrl",
                table: "MobileAppConfigs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IosLatestVersion",
                table: "MobileAppConfigs",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IosMinVersion",
                table: "MobileAppConfigs",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IosStoreUrl",
                table: "MobileAppConfigs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdateMessage",
                table: "MobileAppConfigs",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdateReleaseNotes",
                table: "MobileAppConfigs",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "MobileAppConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-00000000c0f1"),
                columns: new[] { "AndroidLatestVersion", "AndroidMinVersion", "AndroidStoreUrl", "IosLatestVersion", "IosMinVersion", "IosStoreUrl", "UpdateMessage", "UpdateReleaseNotes" },
                values: new object[] { null, null, null, null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AndroidLatestVersion",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "AndroidMinVersion",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "AndroidStoreUrl",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "IosLatestVersion",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "IosMinVersion",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "IosStoreUrl",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "UpdateMessage",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "UpdateReleaseNotes",
                table: "MobileAppConfigs");
        }
    }
}
