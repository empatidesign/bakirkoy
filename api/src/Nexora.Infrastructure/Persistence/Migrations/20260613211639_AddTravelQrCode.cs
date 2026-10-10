using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelQrCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ExcuseUsed",
                table: "FacilityRegistrations",
                newName: "ConsecutiveAbsenceUsed");

            migrationBuilder.RenameColumn(
                name: "ExcuseLimit",
                table: "FacilityGroups",
                newName: "ConsecutiveAbsenceLimit");

            migrationBuilder.RenameColumn(
                name: "ExcuseLimit",
                table: "FacilityBranches",
                newName: "ConsecutiveAbsenceLimit");

            migrationBuilder.CreateTable(
                name: "TravelQrCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    BoardedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelQrCodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TravelQrCodes_ApplicationId",
                table: "TravelQrCodes",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelQrCodes_ApplicationId_Status",
                table: "TravelQrCodes",
                columns: new[] { "ApplicationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TravelQrCodes_ParticipantId",
                table: "TravelQrCodes",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelQrCodes_TravelId",
                table: "TravelQrCodes",
                column: "TravelId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelQrCodes");

            migrationBuilder.RenameColumn(
                name: "ConsecutiveAbsenceUsed",
                table: "FacilityRegistrations",
                newName: "ExcuseUsed");

            migrationBuilder.RenameColumn(
                name: "ConsecutiveAbsenceLimit",
                table: "FacilityGroups",
                newName: "ExcuseLimit");

            migrationBuilder.RenameColumn(
                name: "ConsecutiveAbsenceLimit",
                table: "FacilityBranches",
                newName: "ExcuseLimit");
        }
    }
}
