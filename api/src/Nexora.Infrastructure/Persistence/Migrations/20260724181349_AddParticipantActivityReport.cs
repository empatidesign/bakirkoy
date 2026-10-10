using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantActivityReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ParticipantActivityRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SourceTable = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ItemName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    ActivityDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IdentityKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    SourceUpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipantActivityRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParticipantActivitySyncCursors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LastSyncedUpTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastRunAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastRunUpserts = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipantActivitySyncCursors", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivityRecords_ActivityDate",
                table: "ParticipantActivityRecords",
                column: "ActivityDate");

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivityRecords_IdentityKey_ActivityDate",
                table: "ParticipantActivityRecords",
                columns: new[] { "IdentityKey", "ActivityDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivityRecords_Module_ActivityDate",
                table: "ParticipantActivityRecords",
                columns: new[] { "Module", "ActivityDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivityRecords_Module_SourceId",
                table: "ParticipantActivityRecords",
                columns: new[] { "Module", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivityRecords_ParticipantId_ActivityDate",
                table: "ParticipantActivityRecords",
                columns: new[] { "ParticipantId", "ActivityDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantActivitySyncCursors_Module",
                table: "ParticipantActivitySyncCursors",
                column: "Module",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParticipantActivityRecords");

            migrationBuilder.DropTable(
                name: "ParticipantActivitySyncCursors");
        }
    }
}
