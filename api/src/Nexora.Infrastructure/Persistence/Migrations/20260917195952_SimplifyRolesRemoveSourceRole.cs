using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyRolesRemoveSourceRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""Roles"" SET ""IsDeleted"" = true, ""DeletedAt"" = timezone('utc', now())
                WHERE ""SourceRoleId"" IS NULL
                  AND ""IsDeleted"" = false
                  AND ""IsSuperAdmin"" = false
                  AND ""Id"" NOT IN (SELECT ""RoleId"" FROM ""AdminUsers"" WHERE ""IsDeleted"" = false);");

            migrationBuilder.DropIndex(
                name: "IX_Roles_SourceRoleId",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "SourceRoleId",
                table: "Roles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceRoleId",
                table: "Roles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Roles_SourceRoleId",
                table: "Roles",
                column: "SourceRoleId");
        }
    }
}
