using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileAppConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MobileAppConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WebViewEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WebViewUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    WebViewMaxVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    WebViewMessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MobileAppConfigs", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "MobileAppConfigs",
                columns: new[] { "Id", "CreatedAt", "DeletedAt", "IsDeleted", "UpdatedAt", "WebViewEnabled", "WebViewMaxVersion", "WebViewMessage", "WebViewUrl" },
                values: new object[] { new Guid("00000000-0000-0000-0000-00000000c0f1"), new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, false, null, false, null, null, "" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MobileAppConfigs");
        }
    }
}
