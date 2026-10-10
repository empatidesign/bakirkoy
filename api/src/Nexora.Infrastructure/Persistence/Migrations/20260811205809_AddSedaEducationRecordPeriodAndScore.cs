using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSedaEducationRecordPeriodAndScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PeriodId",
                table: "SedaEducationRecords",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResultNote",
                table: "SedaEducationRecords",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Score",
                table: "SedaEducationRecords",
                type: "numeric(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaEducationRecords_PeriodId",
                table: "SedaEducationRecords",
                column: "PeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_SedaEducationRecords_PeriodId_Tckn",
                table: "SedaEducationRecords",
                columns: new[] { "PeriodId", "Tckn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaEducationRecords_PeriodId",
                table: "SedaEducationRecords");

            migrationBuilder.DropIndex(
                name: "IX_SedaEducationRecords_PeriodId_Tckn",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "PeriodId",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "ResultNote",
                table: "SedaEducationRecords");

            migrationBuilder.DropColumn(
                name: "Score",
                table: "SedaEducationRecords");
        }
    }
}
