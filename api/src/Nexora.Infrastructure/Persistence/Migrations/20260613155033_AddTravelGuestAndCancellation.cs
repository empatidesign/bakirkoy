using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelGuestAndCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CancellationDeadlineHours",
                table: "Travels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "BroughtByParticipantId",
                table: "TravelApplications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GuestBirthDate",
                table: "TravelApplications",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestEmail",
                table: "TravelApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestFullName",
                table: "TravelApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestGender",
                table: "TravelApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestPhone",
                table: "TravelApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestTckn",
                table: "TravelApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsGuest",
                table: "TravelApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancellationDeadlineHours",
                table: "Travels");

            migrationBuilder.DropColumn(
                name: "BroughtByParticipantId",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestBirthDate",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestEmail",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestFullName",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestGender",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestPhone",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "GuestTckn",
                table: "TravelApplications");

            migrationBuilder.DropColumn(
                name: "IsGuest",
                table: "TravelApplications");
        }
    }
}
