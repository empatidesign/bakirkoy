using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityDeviceScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "FacilityId",
                table: "FacilityDevices",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "HallId",
                table: "FacilityDevices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Scope",
                table: "FacilityDevices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "area");

            migrationBuilder.AddColumn<Guid>(
                name: "ServiceFacilityId",
                table: "FacilityDevices",
                type: "uuid",
                nullable: true);


            migrationBuilder.CreateIndex(
                name: "IX_FacilityDevices_ServiceFacilityId",
                table: "FacilityDevices",
                column: "ServiceFacilityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropIndex(
                name: "IX_FacilityDevices_ServiceFacilityId",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "HallId",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "Scope",
                table: "FacilityDevices");

            migrationBuilder.DropColumn(
                name: "ServiceFacilityId",
                table: "FacilityDevices");

            migrationBuilder.AlterColumn<Guid>(
                name: "FacilityId",
                table: "FacilityDevices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
