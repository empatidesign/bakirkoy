using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSedaApplicationPeriodId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PeriodId",
                table: "SedaApplications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_PeriodId",
                table: "SedaApplications",
                column: "PeriodId",
                filter: "\"PeriodId\" IS NOT NULL AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_PeriodId",
                table: "SedaApplications");

            migrationBuilder.DropColumn(
                name: "PeriodId",
                table: "SedaApplications");
        }
    }
}
