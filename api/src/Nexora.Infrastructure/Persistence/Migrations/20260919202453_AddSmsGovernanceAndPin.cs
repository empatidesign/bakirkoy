using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSmsGovernanceAndPin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SmsPinHash",
                table: "AdminUsers",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SmsSendLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Department = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Module = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RecipientCount = table.Column<int>(type: "integer", nullable: false),
                    UsedPinOverride = table.Column<bool>(type: "boolean", nullable: false),
                    WasBlocked = table.Column<bool>(type: "boolean", nullable: false),
                    BlockReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SmsSendLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SmsSendLogs_AdminUserId_CreatedAt",
                table: "SmsSendLogs",
                columns: new[] { "AdminUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SmsSendLogs_CreatedAt",
                table: "SmsSendLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SmsSendLogs_Department",
                table: "SmsSendLogs",
                column: "Department");

            migrationBuilder.CreateIndex(
                name: "IX_SmsSendLogs_Module",
                table: "SmsSendLogs",
                column: "Module");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SmsSendLogs");

            migrationBuilder.DropColumn(
                name: "SmsPinHash",
                table: "AdminUsers");
        }
    }
}
