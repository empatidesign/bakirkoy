using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSedaEducationRecordFlexibleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DetailsJson",
                table: "SedaEducationRecords",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<bool>(
                name: "IsWinner",
                table: "SedaEducationRecords",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "SedaEducationRecords",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Rank",
                table: "SedaEducationRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaEducationRecords_Phone",
                table: "SedaEducationRecords",
                column: "Phone");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaEducationRecords_Phone",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "DetailsJson",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "IsWinner",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "Rank",
                table: "SedaEducationRecords");
        }
    }
}
