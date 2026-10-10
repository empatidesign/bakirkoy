using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenSubmissionSlaNotificationTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SlaBreachNotifiedAt",
                table: "CitizenSubmissions",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SlaWarningNotifiedAt",
                table: "CitizenSubmissions",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SlaBreachNotifiedAt",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "SlaWarningNotifiedAt",
                table: "CitizenSubmissions");
        }
    }
}
