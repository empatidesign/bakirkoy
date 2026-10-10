using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityGroupResidencyMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ResidencyMode",
                table: "FacilityGroups",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResidencyMode",
                table: "FacilityGroups");
        }
    }
}
