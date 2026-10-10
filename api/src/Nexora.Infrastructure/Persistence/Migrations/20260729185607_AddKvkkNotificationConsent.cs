using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKvkkNotificationConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "KvkkAcceptedAt",
                table: "Participants",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NotificationConsentAcceptedAt",
                table: "Participants",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "KvkkAcceptedAt",
                table: "CompanyStaffs",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NotificationConsentAcceptedAt",
                table: "CompanyStaffs",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "KvkkAcceptedAt",
                table: "Companies",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NotificationConsentAcceptedAt",
                table: "Companies",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KvkkAcceptedAt",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "NotificationConsentAcceptedAt",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "KvkkAcceptedAt",
                table: "CompanyStaffs");

            migrationBuilder.DropColumn(
                name: "NotificationConsentAcceptedAt",
                table: "CompanyStaffs");

            migrationBuilder.DropColumn(
                name: "KvkkAcceptedAt",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "NotificationConsentAcceptedAt",
                table: "Companies");
        }
    }
}
