using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityDeviceGroupId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupId",
                table: "FacilityDevices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_GroupId",
                table: "FacilityDevices",
                column: "GroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FacilityDevices_GroupId",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "FacilityDevices");
        }
    }
}
