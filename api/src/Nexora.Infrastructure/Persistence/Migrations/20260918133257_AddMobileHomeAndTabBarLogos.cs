using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileHomeAndTabBarLogos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HomeLogoUrl",
                table: "MobileAppConfigs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TabBarLogoUrl",
                table: "MobileAppConfigs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "MobileAppConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-00000000c0f1"),
                columns: new[] { "HomeLogoUrl", "TabBarLogoUrl" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HomeLogoUrl",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "TabBarLogoUrl",
                table: "MobileAppConfigs");
        }
    }
}
