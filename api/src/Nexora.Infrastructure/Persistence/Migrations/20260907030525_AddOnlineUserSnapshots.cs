using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOnlineUserSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OnlineUserSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TotalOnline = table.Column<int>(type: "integer", nullable: false),
                    AdminOnline = table.Column<int>(type: "integer", nullable: false),
                    CitizenOnline = table.Column<int>(type: "integer", nullable: false),
                    CompanyOnline = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnlineUserSnapshots", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnlineUserSnapshots_CapturedAt",
                table: "OnlineUserSnapshots",
                column: "CapturedAt",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OnlineUserSnapshots");
        }
    }
}
