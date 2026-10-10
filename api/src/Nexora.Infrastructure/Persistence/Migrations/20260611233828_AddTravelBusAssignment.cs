using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelBusAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TravelBuses_TravelId",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "DriverName",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "DriverPhone",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "GuideName",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "GuidePhone",
                table: "TravelBuses");

            migrationBuilder.DropColumn(
                name: "TravelId",
                table: "TravelBuses");

            migrationBuilder.CreateTable(
                name: "TravelBusAssignments",
                columns: table => new
                {
                    TravelId = table.Column<Guid>(type: "uuid", nullable: false),
                    BusId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelBusAssignments", x => new { x.TravelId, x.BusId });
                    table.ForeignKey(
                        name: "FK_TravelBusAssignments_TravelBuses_BusId",
                        column: x => x.BusId,
                        principalTable: "TravelBuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TravelBusAssignments_Travels_TravelId",
                        column: x => x.TravelId,
                        principalTable: "Travels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TravelBusAssignments_BusId",
                table: "TravelBusAssignments",
                column: "BusId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelBusAssignments");

            migrationBuilder.AddColumn<string>(
                name: "DriverName",
                table: "TravelBuses",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DriverPhone",
                table: "TravelBuses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "GuideName",
                table: "TravelBuses",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "GuidePhone",
                table: "TravelBuses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "TravelId",
                table: "TravelBuses",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TravelBuses_TravelId",
                table: "TravelBuses",
                column: "TravelId");
        }
    }
}
