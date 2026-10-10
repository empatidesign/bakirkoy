using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTocTouUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_Participant_ActiveUnique",
                table: "LibrarySessions",
                column: "ParticipantId",
                unique: true,
                filter: "\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" IN ('inside','on_break_short','on_break_long','break_expired','exit_pending')");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_Library_Participant_ActiveUnique",
                table: "LibraryQueueEntries",
                columns: new[] { "LibraryId", "ParticipantId" },
                unique: true,
                filter: "\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" IN ('waiting','called')");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAttendances_Session_Registration_ActiveUnique",
                table: "FacilityAttendances",
                columns: new[] { "SessionId", "RegistrationId" },
                unique: true,
                filter: "\"RegistrationId\" IS NOT NULL AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_Participant_ActiveUnique",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibraryQueueEntries_Library_Participant_ActiveUnique",
                table: "LibraryQueueEntries");

            migrationBuilder.DropIndex(
                name: "IX_FacilityAttendances_Session_Registration_ActiveUnique",
                table: "FacilityAttendances");
        }
    }
}
