using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Perf Batch4 (2026-10-06, canli pg_stat olcumu ile kanitli):
    /// - FacilityAttendances (ParticipantId, FacilityId): anket kitle EXISTS'i 226k satir seq scan yapiyordu.
    /// - Participants (Tckn) tam index: IgnoreQueryFilters TCKN aramasi partial unique'i kullanamiyordu.
    /// - FacilitySessions bekleyen yoklama partial index: dakikalik AttendanceDeadline job'u.
    /// - SystemModules: AK_SystemModules_Key ile mukerrer IX_SystemModules_Key kaldirildi.
    /// IF [NOT] EXISTS: indexler dev DB'ye elle CONCURRENTLY uygulandi; migration idempotent.
    /// </summary>
    public partial class AddPerformanceIndexesBatch4 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_SystemModules_Key\";");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_Participants_Tckn_All\" ON \"Participants\" (\"Tckn\");");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_FacilitySessions_PendingAttendance_Date\" ON \"FacilitySessions\" (\"Date\") WHERE \"AttendanceTakenAt\" IS NULL AND \"IsCancelled\" = false AND \"IsDeleted\" = false;");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_FacilityAttendances_ParticipantId_FacilityId\" ON \"FacilityAttendances\" (\"ParticipantId\", \"FacilityId\");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Participants_Tckn_All\";");
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_FacilitySessions_PendingAttendance_Date\";");
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_FacilityAttendances_ParticipantId_FacilityId\";");
            migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_SystemModules_Key\" ON \"SystemModules\" (\"Key\");");
        }
    }
}
