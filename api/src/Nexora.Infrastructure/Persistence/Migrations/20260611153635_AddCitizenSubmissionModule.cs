using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenSubmissionModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_CitizenSubmission",
                table: "CitizenSubmission");

            migrationBuilder.RenameTable(
                name: "CitizenSubmission",
                newName: "CitizenSubmissions");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_SubmittedAt",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_SubmittedAt");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_SubmissionType",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_SubmissionType");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_Status",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_Status");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_Priority",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_Priority");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_Neighborhood",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_Neighborhood");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmission_CategoryId",
                table: "CitizenSubmissions",
                newName: "IX_CitizenSubmissions_CategoryId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_CitizenSubmissions",
                table: "CitizenSubmissions",
                column: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_CitizenSubmissions",
                table: "CitizenSubmissions");

            migrationBuilder.RenameTable(
                name: "CitizenSubmissions",
                newName: "CitizenSubmission");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_SubmittedAt",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_SubmittedAt");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_SubmissionType",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_SubmissionType");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_Status",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_Status");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_Priority",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_Priority");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_Neighborhood",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_Neighborhood");

            migrationBuilder.RenameIndex(
                name: "IX_CitizenSubmissions_CategoryId",
                table: "CitizenSubmission",
                newName: "IX_CitizenSubmission_CategoryId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_CitizenSubmission",
                table: "CitizenSubmission",
                column: "Id");
        }
    }
}
