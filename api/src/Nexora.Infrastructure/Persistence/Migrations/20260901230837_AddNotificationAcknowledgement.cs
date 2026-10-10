using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationAcknowledgement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcknowledgedAt",
                table: "Notifications",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresAck",
                table: "Notifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RecipientId_AcknowledgedAt",
                table: "Notifications",
                columns: new[] { "RecipientId", "AcknowledgedAt" },
                filter: "\"RequiresAck\" = true AND \"AcknowledgedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_RecipientId_AcknowledgedAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "RequiresAck",
                table: "Notifications");
        }
    }
}
