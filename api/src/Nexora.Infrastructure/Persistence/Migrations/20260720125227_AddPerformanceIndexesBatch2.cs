using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexesBatch2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_LibraryId",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_Status",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibraryReservations_LibraryId",
                table: "LibraryReservations");

            migrationBuilder.DropIndex(
                name: "IX_LibraryReservations_Status",
                table: "LibraryReservations");

            migrationBuilder.DropIndex(
                name: "IX_LibraryQueueEntries_LibraryId",
                table: "LibraryQueueEntries");

            migrationBuilder.DropIndex(
                name: "IX_LibraryQueueEntries_Status",
                table: "LibraryQueueEntries");

            migrationBuilder.DropIndex(
                name: "IX_LibraryBreaks_LibraryId",
                table: "LibraryBreaks");

            migrationBuilder.DropIndex(
                name: "IX_LibraryBreaks_Status",
                table: "LibraryBreaks");

            migrationBuilder.DropIndex(
                name: "IX_FacilitySessions_Date",
                table: "FacilitySessions");

            migrationBuilder.DropIndex(
                name: "IX_FacilitySessions_FacilityId",
                table: "FacilitySessions");

            migrationBuilder.DropIndex(
                name: "IX_FacilityRegistrations_Status",
                table: "FacilityRegistrations");

            migrationBuilder.DropIndex(
                name: "IX_FacilityMasterAccessLogs_At",
                table: "FacilityMasterAccessLogs");

            migrationBuilder.DropIndex(
                name: "IX_FacilityMasterAccessLogs_ServiceFacilityId",
                table: "FacilityMasterAccessLogs");

            migrationBuilder.DropIndex(
                name: "IX_FacilityGroups_Module",
                table: "FacilityGroups");

            migrationBuilder.DropIndex(
                name: "IX_FacilityApplications_FacilityId",
                table: "FacilityApplications");

            migrationBuilder.DropIndex(
                name: "IX_FacilityApplications_Status",
                table: "FacilityApplications");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_LibraryId_ExitTime",
                table: "LibrarySessions",
                columns: new[] { "LibraryId", "ExitTime" },
                filter: "\"ExitTime\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_LibraryId_Status",
                table: "LibrarySessions",
                columns: new[] { "LibraryId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_PendingExitAt",
                table: "LibrarySessions",
                column: "PendingExitAt",
                filter: "\"PendingExitAt\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_LibraryId_Status",
                table: "LibraryReservations",
                columns: new[] { "LibraryId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_Tckn",
                table: "LibraryReservations",
                column: "Tckn");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_LibraryId_Status",
                table: "LibraryQueueEntries",
                columns: new[] { "LibraryId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_ParticipantId",
                table: "LibraryQueueEntries",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_LibraryId_Status",
                table: "LibraryBreaks",
                columns: new[] { "LibraryId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_FacilityId_Date",
                table: "FacilitySessions",
                columns: new[] { "FacilityId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_ApplicationId",
                table: "FacilityRegistrations",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_FacilityId",
                table: "FacilityRegistrations",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_ServiceFacilityId_At",
                table: "FacilityMasterAccessLogs",
                columns: new[] { "ServiceFacilityId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_Module_IsActive",
                table: "FacilityGroups",
                columns: new[] { "Module", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_FacilityId_Status",
                table: "FacilityApplications",
                columns: new[] { "FacilityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_ParticipantId",
                table: "FacilityApplications",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_FacilityId",
                table: "Events",
                column: "FacilityId",
                filter: "\"FacilityId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Events_HallId",
                table: "Events",
                column: "HallId",
                filter: "\"HallId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Events_StartDate",
                table: "Events",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_EventActivities_ParticipantId_EventId",
                table: "EventActivities",
                columns: new[] { "ParticipantId", "EventId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_LibraryId_ExitTime",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_LibraryId_Status",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySessions_PendingExitAt",
                table: "LibrarySessions");

            migrationBuilder.DropIndex(
                name: "IX_LibraryReservations_LibraryId_Status",
                table: "LibraryReservations");

            migrationBuilder.DropIndex(
                name: "IX_LibraryReservations_Tckn",
                table: "LibraryReservations");

            migrationBuilder.DropIndex(
                name: "IX_LibraryQueueEntries_LibraryId_Status",
                table: "LibraryQueueEntries");

            migrationBuilder.DropIndex(
                name: "IX_LibraryQueueEntries_ParticipantId",
                table: "LibraryQueueEntries");

            migrationBuilder.DropIndex(
                name: "IX_LibraryBreaks_LibraryId_Status",
                table: "LibraryBreaks");

            migrationBuilder.DropIndex(
                name: "IX_FacilitySessions_FacilityId_Date",
                table: "FacilitySessions");

            migrationBuilder.DropIndex(
                name: "IX_FacilityRegistrations_ApplicationId",
                table: "FacilityRegistrations");

            migrationBuilder.DropIndex(
                name: "IX_FacilityRegistrations_FacilityId",
                table: "FacilityRegistrations");

            migrationBuilder.DropIndex(
                name: "IX_FacilityMasterAccessLogs_ServiceFacilityId_At",
                table: "FacilityMasterAccessLogs");

            migrationBuilder.DropIndex(
                name: "IX_FacilityGroups_Module_IsActive",
                table: "FacilityGroups");

            migrationBuilder.DropIndex(
                name: "IX_FacilityApplications_FacilityId_Status",
                table: "FacilityApplications");

            migrationBuilder.DropIndex(
                name: "IX_FacilityApplications_ParticipantId",
                table: "FacilityApplications");

            migrationBuilder.DropIndex(
                name: "IX_Events_FacilityId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_HallId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_StartDate",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_EventActivities_ParticipantId_EventId",
                table: "EventActivities");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_LibraryId",
                table: "LibrarySessions",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySessions_Status",
                table: "LibrarySessions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_LibraryId",
                table: "LibraryReservations",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryReservations_Status",
                table: "LibraryReservations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_LibraryId",
                table: "LibraryQueueEntries",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryQueueEntries_Status",
                table: "LibraryQueueEntries",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_LibraryId",
                table: "LibraryBreaks",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryBreaks_Status",
                table: "LibraryBreaks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_Date",
                table: "FacilitySessions",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_FacilitySessions_FacilityId",
                table: "FacilitySessions",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_Status",
                table: "FacilityRegistrations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_At",
                table: "FacilityMasterAccessLogs",
                column: "At");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMasterAccessLogs_ServiceFacilityId",
                table: "FacilityMasterAccessLogs",
                column: "ServiceFacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_Module",
                table: "FacilityGroups",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_FacilityId",
                table: "FacilityApplications",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityApplications_Status",
                table: "FacilityApplications",
                column: "Status");
        }
    }
}
