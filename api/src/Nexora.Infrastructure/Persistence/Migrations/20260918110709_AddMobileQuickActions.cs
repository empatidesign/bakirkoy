using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileQuickActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MobileQuickActions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Target = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Label = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresAuth = table.Column<bool>(type: "boolean", nullable: false),
                    TargetUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MobileQuickActions", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "MobileQuickActions",
                columns: new[] { "Id", "Color", "CreatedAt", "DeletedAt", "Icon", "IsActive", "IsDeleted", "Label", "RequiresAuth", "SortOrder", "Target", "TargetUrl", "UpdatedAt" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-0000-0000-00000000ca01"), "#E11D48", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Siren", true, false, "Acil", false, 10, "emergency", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca02"), "#7C3AED", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Pill", true, false, "Nöbetçi\nEczane", false, 20, "pharmacy", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca03"), "#0284C7", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Landmark", true, false, "e-Belediye", false, 30, "ebelediye", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca04"), "#16A34A", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "MapPin", true, false, "Şehir\nRehberi", false, 40, "cityguide", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca05"), "#D97706", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "MessageSquare", true, false, "Talep\nŞikayet", false, 50, "request", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca06"), "#9333EA", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "FileText", true, false, "Başvurularım", true, 60, "applications", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca07"), "#0891B2", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Building2", true, false, "Tesisler", false, 70, "facilities", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca08"), "#DB2777", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Calendar", true, false, "Etkinlikler", false, 80, "events", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca09"), "#059669", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Megaphone", true, false, "Duyurular", false, 90, "announcements", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca10"), "#4F46E5", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "LayoutGrid", true, false, "Hizmetler", false, 100, "services", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca11"), "#4F46E5", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "Search", true, false, "Hızlı\nArama", false, 110, "search", null, null },
                    { new Guid("00000000-0000-0000-0000-00000000ca12"), "#059669", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "PhoneCall", true, false, "Çağrı\nMerkezi", false, 120, "callcenter", null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_MobileQuickActions_SortOrder",
                table: "MobileQuickActions",
                column: "SortOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MobileQuickActions");
        }
    }
}
