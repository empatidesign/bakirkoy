using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityRegistrationUniqueActiveIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_FacilityRegistrations_GroupId_Tckn_ActiveUnique",
                table: "FacilityRegistrations",
                columns: new[] { "GroupId", "Tckn" },
                unique: true,
                filter: "\"Status\" = 'active' AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FacilityRegistrations_GroupId_Tckn_ActiveUnique",
                table: "FacilityRegistrations");
        }
    }
}
