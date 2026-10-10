using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexesBatch1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelApplications_TravelId",
                table: "TravelApplications");

            migrationBuilder.DropIndex(
                name: "IX_Participants_Status",
                table: "Participants");

            migrationBuilder.DropIndex(
                name: "IX_EventApplications_EventId",
                table: "EventApplications");

            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_Neighborhood",
                table: "CitizenSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_Priority",
                table: "CitizenSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_SubmissionType",
                table: "CitizenSubmissions");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId_Status",
                table: "TravelApplications",
                columns: new[] { "TravelId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_HallId_Date",
                table: "Sessions",
                columns: new[] { "HallId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Participants_FullName",
                table: "Participants",
                column: "FullName")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Participants_Phone",
                table: "Participants",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_GiftRequests_ParticipantId_Status",
                table: "GiftRequests",
                columns: new[] { "ParticipantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_GiftRequests_RequestedAt",
                table: "GiftRequests",
                column: "RequestedAt");

            migrationBuilder.CreateIndex(
                name: "IX_EventApplications_EventId_Status",
                table: "EventApplications",
                columns: new[] { "EventId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EventApplications_SessionId_Status_CreatedAt",
                table: "EventApplications",
                columns: new[] { "SessionId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_CitizenTc",
                table: "CitizenSubmissions",
                column: "CitizenTc");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_Neighborhood_SubmittedAt",
                table: "CitizenSubmissions",
                columns: new[] { "Neighborhood", "SubmittedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelApplications_TravelId_Status",
                table: "TravelApplications");

            migrationBuilder.DropIndex(
                name: "IX_Sessions_HallId_Date",
                table: "Sessions");

            migrationBuilder.DropIndex(
                name: "IX_Participants_FullName",
                table: "Participants");

            migrationBuilder.DropIndex(
                name: "IX_Participants_Phone",
                table: "Participants");

            migrationBuilder.DropIndex(
                name: "IX_GiftRequests_ParticipantId_Status",
                table: "GiftRequests");

            migrationBuilder.DropIndex(
                name: "IX_GiftRequests_RequestedAt",
                table: "GiftRequests");

            migrationBuilder.DropIndex(
                name: "IX_EventApplications_EventId_Status",
                table: "EventApplications");

            migrationBuilder.DropIndex(
                name: "IX_EventApplications_SessionId_Status_CreatedAt",
                table: "EventApplications");

            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_CitizenTc",
                table: "CitizenSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_CitizenSubmissions_Neighborhood_SubmittedAt",
                table: "CitizenSubmissions");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.CreateIndex(
                name: "IX_TravelApplications_TravelId",
                table: "TravelApplications",
                column: "TravelId");

            migrationBuilder.CreateIndex(
                name: "IX_Participants_Status",
                table: "Participants",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EventApplications_EventId",
                table: "EventApplications",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_Neighborhood",
                table: "CitizenSubmissions",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_Priority",
                table: "CitizenSubmissions",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissions_SubmissionType",
                table: "CitizenSubmissions",
                column: "SubmissionType");
        }
    }
}
