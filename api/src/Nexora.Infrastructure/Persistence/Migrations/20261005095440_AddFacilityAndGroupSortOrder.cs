using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityAndGroupSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "FacilityGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Facilities",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityGroups_FacilityId_ParentGroupId_SortOrder",
                table: "FacilityGroups",
                columns: new[] { "FacilityId", "ParentGroupId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Facilities_Module_SortOrder",
                table: "Facilities",
                columns: new[] { "Module", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FacilityGroups_FacilityId_ParentGroupId_SortOrder",
                table: "FacilityGroups");

            migrationBuilder.DropIndex(
                name: "IX_Facilities_Module_SortOrder",
                table: "Facilities");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "FacilityGroups");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Facilities");
        }
    }
}
