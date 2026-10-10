using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventStaticQr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOT (2026-10-06): "FacilityBranches.Category" buradan çıkarıldı — kolon canlı
            // veritabanında eşzamanlı başka bir ajan tarafından (migration history'de kaydı
            // olmadan) zaten fiziksel olarak eklenmişti; burada tekrar eklemek "column already
            // exists" hatası verir. Model snapshot'ta alan doğru şekilde kalıyor (entity'de
            // gerçekten var), sadece bu migration'ın Up/Down'ı artık onu dokunmuyor.
            migrationBuilder.AddColumn<string>(
                name: "StaticQrCode",
                table: "Events",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StaticQrEnabled",
                table: "Events",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "StaticQrMinExitSeconds",
                table: "Events",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<string>(
                name: "StaticQrMode",
                table: "Events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "attendance");

            migrationBuilder.AddColumn<int>(
                name: "StaticQrReentryCooldownSeconds",
                table: "Events",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Events_StaticQrCode",
                table: "Events",
                column: "StaticQrCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Events_StaticQrCode",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StaticQrCode",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StaticQrEnabled",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StaticQrMinExitSeconds",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StaticQrMode",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StaticQrReentryCooldownSeconds",
                table: "Events");
        }
    }
}
