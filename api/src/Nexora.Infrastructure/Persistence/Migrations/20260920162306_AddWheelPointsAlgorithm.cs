using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWheelPointsAlgorithm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PointsAlgorithmBase",
                table: "Wheels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "PointsAlgorithmEnabled",
                table: "Wheels",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PointsAlgorithmMax",
                table: "Wheels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsAlgorithmMaxSpins",
                table: "Wheels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsAlgorithmStep",
                table: "Wheels",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PointsAlgorithmBase",
                table: "Wheels");

            migrationBuilder.DropColumn(
                name: "PointsAlgorithmEnabled",
                table: "Wheels");

            migrationBuilder.DropColumn(
                name: "PointsAlgorithmMax",
                table: "Wheels");

            migrationBuilder.DropColumn(
                name: "PointsAlgorithmMaxSpins",
                table: "Wheels");

            migrationBuilder.DropColumn(
                name: "PointsAlgorithmStep",
                table: "Wheels");
        }
    }
}
