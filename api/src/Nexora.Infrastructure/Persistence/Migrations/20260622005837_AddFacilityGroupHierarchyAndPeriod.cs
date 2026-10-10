using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityGroupHierarchyAndPeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AcademyWhitelistEnabled",
                table: "FacilityGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApplicationEndDate",
                table: "FacilityGroups",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApplicationStartDate",
                table: "FacilityGroups",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentGroupId",
                table: "FacilityGroups",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PeriodCount",
                table: "FacilityGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PeriodType",
                table: "FacilityGroups",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_ParentGroupId",
                table: "FacilityGroups",
                column: "ParentGroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FacilityGroups_ParentGroupId",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "AcademyWhitelistEnabled",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "ApplicationEndDate",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "ApplicationStartDate",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "ParentGroupId",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "PeriodCount",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "PeriodType",
                table: "FacilityGroups");
        }
    }
}
