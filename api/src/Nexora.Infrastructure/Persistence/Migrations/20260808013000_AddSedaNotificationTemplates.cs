using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Nexora.Infrastructure.Persistence;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    public partial class AddSedaNotificationTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"SedaSettings\" ADD COLUMN IF NOT EXISTS \"NotificationTemplatesJson\" jsonb NOT NULL DEFAULT '[]';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"SedaSettings\" DROP COLUMN IF EXISTS \"NotificationTemplatesJson\";");
        }
    }
}
