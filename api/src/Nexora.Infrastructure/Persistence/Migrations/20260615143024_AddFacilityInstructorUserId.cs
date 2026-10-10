using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityInstructorUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "FacilityInstructors",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityInstructors_UserId",
                table: "FacilityInstructors",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FacilityInstructors_UserId",
                table: "FacilityInstructors");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "FacilityInstructors");
        }
    }
}
