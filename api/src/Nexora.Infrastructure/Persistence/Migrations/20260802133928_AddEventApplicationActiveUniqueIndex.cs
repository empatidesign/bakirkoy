using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventApplicationActiveUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT "Id", row_number() OVER (
                        PARTITION BY "EventId", "SessionId", "ParticipantId"
                        ORDER BY "CreatedAt" ASC, "Id" ASC) AS rn
                    FROM "EventApplications"
                    WHERE "IsDeleted" = false AND "Status" NOT IN ('rejected', 'cancelled'))
                UPDATE "EventApplications" e
                SET "IsDeleted" = true, "DeletedAt" = now()
                FROM ranked r
                WHERE e."Id" = r."Id" AND r.rn > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_EventApplications_ActiveUnique",
                table: "EventApplications",
                columns: new[] { "EventId", "SessionId", "ParticipantId" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected', 'cancelled')")
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EventApplications_ActiveUnique",
                table: "EventApplications");
        }
    }
}
