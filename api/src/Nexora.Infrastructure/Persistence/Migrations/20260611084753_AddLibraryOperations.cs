using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LibraryBreaks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpectedReturnAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    GraceUntil = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SeatHeld = table.Column<bool>(type: "boolean", nullable: false),
                    Seat = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryBreaks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LibraryQueueEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uuid", nullable: false),
                    QueueNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    GuardianPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CalledAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CountdownExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryQueueEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LibraryReservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    GuardianPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Seat = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ReservedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SlotStart = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SlotEnd = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    HoldUntil = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryReservations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LibrarySessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LibraryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    GuardianPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Seat = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    EntryTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExitTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ShortBreaksUsed = table.Column<int>(type: "integer", nullable: false),
                    LongBreaksUsed = table.Column<int>(type: "integer", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibrarySessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_LibraryId",
                table: "LibraryBreaks",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_SessionId",
                table: "LibraryBreaks",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_Status",
                table: "LibraryBreaks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_LibraryId",
                table: "LibraryQueueEntries",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_Status",
                table: "LibraryQueueEntries",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_LibraryId",
                table: "LibraryReservations",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_ParticipantId",
                table: "LibraryReservations",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_Status",
                table: "LibraryReservations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_LibraryId",
                table: "LibrarySessions",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_ParticipantId",
                table: "LibrarySessions",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_Status",
                table: "LibrarySessions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_Tckn",
                table: "LibrarySessions",
                column: "Tckn");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LibraryBreaks");

            migrationBuilder.DropTable(
                name: "LibraryQueueEntries");

            migrationBuilder.DropTable(
                name: "LibraryReservations");

            migrationBuilder.DropTable(
                name: "LibrarySessions");
        }
    }
}
