using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCampaignUsageCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "DiscountUsages",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "DiscountUsages",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "CampaignRedemptions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "CampaignRedemptions",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCancelled",
                table: "CampaignRedemptions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "DiscountUsages");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "DiscountUsages");

            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "CampaignRedemptions");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "CampaignRedemptions");

            migrationBuilder.DropColumn(
                name: "IsCancelled",
                table: "CampaignRedemptions");
        }
    }
}
