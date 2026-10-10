using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyServiceCategoryFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignServiceCategories");

            migrationBuilder.DropTable(
                name: "CompanyServiceCategories");

            migrationBuilder.AddColumn<Guid>(
                name: "ServiceCategoryId",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Companies_ServiceCategoryId",
                table: "Companies",
                column: "ServiceCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Companies_ServiceCategories_ServiceCategoryId",
                table: "Companies",
                column: "ServiceCategoryId",
                principalTable: "ServiceCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Companies_ServiceCategories_ServiceCategoryId",
                table: "Companies");

            migrationBuilder.DropIndex(
                name: "IX_Companies_ServiceCategoryId",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ServiceCategoryId",
                table: "Companies");

            migrationBuilder.CreateTable(
                name: "CampaignServiceCategories",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriesId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignServiceCategories", x => new { x.CampaignId, x.CategoriesId });
                    table.ForeignKey(
                        name: "FK_CampaignServiceCategories_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CampaignServiceCategories_ServiceCategories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "ServiceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CompanyServiceCategories",
                columns: table => new
                {
                    CategoriesId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompaniesId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanyServiceCategories", x => new { x.CategoriesId, x.CompaniesId });
                    table.ForeignKey(
                        name: "FK_CompanyServiceCategories_Companies_CompaniesId",
                        column: x => x.CompaniesId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CompanyServiceCategories_ServiceCategories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "ServiceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignServiceCategories_CategoriesId",
                table: "CampaignServiceCategories",
                column: "CategoriesId");

            migrationBuilder.CreateIndex(
                name: "IX_CompanyServiceCategories_CompaniesId",
                table: "CompanyServiceCategories",
                column: "CompaniesId");
        }
    }
}
