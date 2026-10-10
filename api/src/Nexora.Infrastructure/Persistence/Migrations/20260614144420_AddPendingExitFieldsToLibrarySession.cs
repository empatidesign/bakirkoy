using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPendingExitFieldsToLibrarySession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventQrCodes");

            migrationBuilder.AddColumn<bool>(
                name: "IsExitNoShow",
                table: "LibrarySessions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingExitAt",
                table: "LibrarySessions",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsExitNoShow",
                table: "LibrarySessions");

            migrationBuilder.DropColumn(
                name: "PendingExitAt",
                table: "LibrarySessions");

            migrationBuilder.CreateTable(
                name: "EventQrCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: true),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    MaxUsage = table.Column<int>(type: "integer", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferenceDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ScannedCount = table.Column<int>(type: "integer", nullable: false),
                    SeatNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ValidUntil = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventQrCodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventQrCodes_Code",
                table: "EventQrCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventQrCodes_EventId",
                table: "EventQrCodes",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_EventQrCodes_ParticipantId",
                table: "EventQrCodes",
                column: "ParticipantId");
        }
    }
}
