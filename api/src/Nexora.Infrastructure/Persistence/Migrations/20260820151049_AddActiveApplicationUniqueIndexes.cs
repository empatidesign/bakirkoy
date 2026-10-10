using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddActiveApplicationUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""TravelApplications"" AS t
                SET ""Status"" = 'cancelled', ""UpdatedAt"" = now()
                WHERE t.""IsDeleted"" = false
                  AND t.""ParticipantId"" IS NOT NULL
                  AND t.""Status"" NOT IN ('rejected','cancelled')
                  AND EXISTS (
                    SELECT 1 FROM ""TravelApplications"" AS e
                    WHERE e.""TravelId"" = t.""TravelId""
                      AND e.""ParticipantId"" = t.""ParticipantId""
                      AND e.""IsDeleted"" = false
                      AND e.""Status"" NOT IN ('rejected','cancelled')
                      AND (e.""CreatedAt"" < t.""CreatedAt"" OR (e.""CreatedAt"" = t.""CreatedAt"" AND e.""Id"" < t.""Id"")));");

            migrationBuilder.Sql(@"
                UPDATE ""SedaApplications"" AS s
                SET ""Status"" = 'cancelled', ""UpdatedAt"" = now()
                WHERE s.""IsDeleted"" = false
                  AND s.""Status"" NOT IN ('rejected','cancelled')
                  AND EXISTS (
                    SELECT 1 FROM ""SedaApplications"" AS e
                    WHERE e.""Tckn"" = s.""Tckn""
                      AND e.""IsDeleted"" = false
                      AND e.""Status"" NOT IN ('rejected','cancelled')
                      AND (e.""CreatedAt"" < s.""CreatedAt"" OR (e.""CreatedAt"" = s.""CreatedAt"" AND e.""Id"" < s.""Id"")));");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications",
                columns: new[] { "TravelId", "ParticipantId" },
                unique: true,
                filter: "\"ParticipantId\" IS NOT NULL AND \"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications",
                column: "Tckn",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelApplications_TravelId_ParticipantId",
                table: "TravelApplications");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications");
        }
    }
}
