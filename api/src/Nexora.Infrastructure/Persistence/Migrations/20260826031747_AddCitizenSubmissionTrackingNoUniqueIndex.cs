using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenSubmissionTrackingNoUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // #21 fix: TrackingNo eşzamanlı başvurularda çakışıyordu (SUB-{unixSaniye} formatı).
            // ModelSnapshot daha önce yanlışlıkla bu index'i içeriyordu ama gerçek migration
            // hiç oluşturulmamıştı (snapshot/migration drift) — bu migration eksikliği giderir.
            // Uygulanmadan önce mevcut çakışan kayıtlar (263 satır, 31 grup) manuel backfill
            // ile benzersizleştirildi (bkz. commit mesajı / operasyon notu).
            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_TrackingNo",
                table: "CitizenSubmissions",
                column: "TrackingNo",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_TrackingNo",
                table: "CitizenSubmissions");
        }
    }
}
