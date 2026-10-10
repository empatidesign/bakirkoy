using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventApplicationDatesRemoveOfferingPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApplicationEndDate",
                table: "Events",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApplicationStartDate",
                table: "Events",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_ApplicationEndDate",
                table: "Events",
                column: "ApplicationEndDate",
                filter: "\"ApplicationEndDate\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Events_ApplicationStartDate",
                table: "Events",
                column: "ApplicationStartDate",
                filter: "\"ApplicationStartDate\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Events_ApplicationEndDate",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_ApplicationStartDate",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ApplicationEndDate",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ApplicationStartDate",
                table: "Events");
        }
    }
}
