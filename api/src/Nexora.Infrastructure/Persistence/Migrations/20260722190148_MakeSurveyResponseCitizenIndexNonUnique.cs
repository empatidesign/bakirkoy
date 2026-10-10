using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeSurveyResponseCitizenIndexNonUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_SurveyId_CitizenTc",
                table: "SurveyResponses");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId_CitizenTc",
                table: "SurveyResponses",
                columns: new[] { "SurveyId", "CitizenTc" },
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_SurveyId_CitizenTc",
                table: "SurveyResponses");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId_CitizenTc",
                table: "SurveyResponses",
                columns: new[] { "SurveyId", "CitizenTc" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }
    }
}
