using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantAppointmentKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppointmentKey",
                table: "Participants",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Participants_AppointmentKey",
                table: "Participants",
                column: "AppointmentKey",
                unique: true,
                filter: "\"AppointmentKey\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Participants_AppointmentKey",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "AppointmentKey",
                table: "Participants");
        }
    }
}
