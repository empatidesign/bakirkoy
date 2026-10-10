using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelRoutesAndBackfill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RouteId",
                table: "Travels",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "SourceBusId",
                table: "TravelBuses",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TravelRoutes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Destination = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Conditions = table.Column<string>(type: "text", nullable: false),
                    InternalNote = table.Column<string>(type: "text", nullable: false),
                    Gender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MinAge = table.Column<int>(type: "integer", nullable: false),
                    MaxAge = table.Column<int>(type: "integer", nullable: false),
                    RestrictionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ImagesJson = table.Column<string>(type: "jsonb", nullable: false),
                    PricingJson = table.Column<string>(type: "jsonb", nullable: false),
                    PointsJson = table.Column<string>(type: "jsonb", nullable: false),
                    SultangaziResidentOnly = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelRoutes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Travels_RouteId",
                table: "Travels",
                column: "RouteId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelBuses_SourceBusId",
                table: "TravelBuses",
                column: "SourceBusId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRoutes_CategoryId",
                table: "TravelRoutes",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRoutes_Name",
                table: "TravelRoutes",
                column: "Name");

            // --- Veri göçü: her mevcut Travel(Sefer) için kendi 1:1 TravelRoute(Gezi) kaydını oluştur ---
            // İçerik alanları (Name/Destination/Description/Conditions/InternalNote/Gender/MinAge/MaxAge/
            // RestrictionsJson/ImagesJson/PricingJson/PointsJson/SultangaziResidentOnly/Latitude/Longitude)
            // Travel'dan Route'a birebir kopyalanır; Route.IsActive her zaman true (Route seviyesinde
            // yayın durumu yoktur, yayın durumu Sefer'e (Travel.IsActive) özgüdür).
            migrationBuilder.Sql(@"
                INSERT INTO ""TravelRoutes"" (
                    ""Id"", ""Name"", ""CategoryId"", ""Destination"", ""Latitude"", ""Longitude"",
                    ""Description"", ""Conditions"", ""InternalNote"", ""Gender"", ""MinAge"", ""MaxAge"",
                    ""RestrictionsJson"", ""ImagesJson"", ""PricingJson"", ""PointsJson"",
                    ""SultangaziResidentOnly"", ""IsActive"", ""CreatedBy"", ""UpdatedBy"",
                    ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"", ""DeletedAt""
                )
                SELECT
                    t.""Id"", t.""Name"", t.""CategoryId"", t.""Destination"", t.""Latitude"", t.""Longitude"",
                    t.""Description"", t.""Conditions"", t.""InternalNote"", t.""Gender"", t.""MinAge"", t.""MaxAge"",
                    t.""RestrictionsJson"", t.""ImagesJson"", t.""PricingJson"", t.""PointsJson"",
                    t.""SultangaziResidentOnly"", true, t.""CreatedBy"", t.""UpdatedBy"",
                    t.""CreatedAt"", t.""UpdatedAt"", false, NULL
                FROM ""Travels"" t;

                UPDATE ""Travels"" t SET ""RouteId"" = t.""Id"";
            ");

            migrationBuilder.AddForeignKey(
                name: "FK_Travels_TravelRoutes_RouteId",
                table: "Travels",
                column: "RouteId",
                principalTable: "TravelRoutes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Travels_TravelRoutes_RouteId",
                table: "Travels");

            migrationBuilder.DropTable(
                name: "TravelRoutes");

            migrationBuilder.DropIndex(
                name: "IX_Travels_RouteId",
                table: "Travels");

            migrationBuilder.DropIndex(
                name: "IX_TravelBuses_SourceBusId",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "RouteId",
                table: "Travels");

            migrationBuilder.DropColumn(
                name: "SourceBusId",
                table: "TravelBuses");
        }
    }
}
