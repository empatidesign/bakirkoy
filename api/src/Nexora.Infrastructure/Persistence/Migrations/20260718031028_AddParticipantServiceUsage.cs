using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantServiceUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ParticipantServiceUsages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    BranchName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: true),
                    FacilityName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    HasReceivedService = table.Column<bool>(type: "boolean", nullable: false),
                    FirstServiceDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastServiceDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipantServiceUsages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParticipantServiceUsages_Participants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "Participants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantServiceUsages_Module",
                table: "ParticipantServiceUsages",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantServiceUsages_Module_ParticipantId",
                table: "ParticipantServiceUsages",
                columns: new[] { "Module", "ParticipantId" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantServiceUsages_ParticipantId",
                table: "ParticipantServiceUsages",
                column: "ParticipantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParticipantServiceUsages");
        }
    }
}
