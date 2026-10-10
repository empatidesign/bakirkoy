using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddScopeAndAuthority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminPermissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Effect = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminPermissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AdminScopes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScopeNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IncludeDescendants = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminScopes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScopeEdges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChildNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScopeEdges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScopeNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RefModuleKey = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    RefId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScopeNodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminPermissions_AdminUserId",
                table: "AdminPermissions",
                column: "AdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminPermissions_AdminUserId_PermissionId",
                table: "AdminPermissions",
                columns: new[] { "AdminUserId", "PermissionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminScopes_AdminUserId",
                table: "AdminScopes",
                column: "AdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminScopes_AdminUserId_ScopeNodeId",
                table: "AdminScopes",
                columns: new[] { "AdminUserId", "ScopeNodeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScopeEdges_ChildNodeId",
                table: "ScopeEdges",
                column: "ChildNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_ScopeEdges_ParentNodeId_ChildNodeId",
                table: "ScopeEdges",
                columns: new[] { "ParentNodeId", "ChildNodeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScopeNodes_RefModuleKey_RefId",
                table: "ScopeNodes",
                columns: new[] { "RefModuleKey", "RefId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminPermissions");

            migrationBuilder.DropTable(
                name: "AdminScopes");

            migrationBuilder.DropTable(
                name: "ScopeEdges");

            migrationBuilder.DropTable(
                name: "ScopeNodes");
        }
    }
}
