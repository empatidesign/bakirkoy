using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TravelApplicationUniqueExcludeGuest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications",
                columns: new[] { "TravelId", "ParticipantId" },
                unique: true,
                filter: "\"ParticipantId\" IS NOT NULL AND \"IsGuest\" = false AND \"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications",
                columns: new[] { "TravelId", "ParticipantId" },
                unique: true,
                filter: "\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");
        }
    }
}
