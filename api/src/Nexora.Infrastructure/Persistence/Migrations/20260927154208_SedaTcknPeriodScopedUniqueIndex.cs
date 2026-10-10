using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SedaTcknPeriodScopedUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn_NoPeriod",
                table: "SedaApplications",
                column: "Tckn",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled') AND \"PeriodId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn_PeriodId",
                table: "SedaApplications",
                columns: new[] { "Tckn", "PeriodId" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled') AND \"PeriodId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Tckn_NoPeriod",
                table: "SedaApplications");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Tckn_PeriodId",
                table: "SedaApplications");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications",
                column: "Tckn",
                unique: true,
                filter: "\"IsDeleted\" = false AND \"Status\" NOT IN ('rejected','cancelled')");
        }
    }
}
