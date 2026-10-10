using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenSubmissionUlakbelForwardState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UlakbelForwardState",
                table: "CitizenSubmissions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UlakbelLastAttemptAt",
                table: "CitizenSubmissions",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UlakbelForwardState",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "UlakbelLastAttemptAt",
                table: "CitizenSubmissions");
        }
    }
}
