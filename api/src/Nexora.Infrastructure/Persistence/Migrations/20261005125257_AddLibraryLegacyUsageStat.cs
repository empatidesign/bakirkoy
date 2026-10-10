using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryLegacyUsageStat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LibraryLegacyUsageStats",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    TotalVisits = table.Column<int>(type: "integer", nullable: false),
                    TotalHours = table.Column<double>(type: "double precision", nullable: false),
                    FirstVisitAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastVisitAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PrimaryLocationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ImportBatchId = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryLegacyUsageStats", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLegacyUsageStats_Tckn",
                table: "LibraryLegacyUsageStats",
                column: "Tckn",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryLegacyUsageStats_TotalVisits",
                table: "LibraryLegacyUsageStats",
                column: "TotalVisits");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LibraryLegacyUsageStats");
        }
    }
}
