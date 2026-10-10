using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanionColumnDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""EventApplications""  ALTER COLUMN ""HasCompanion""   SET DEFAULT false;");
            migrationBuilder.Sql(@"ALTER TABLE ""EventApplications""  ALTER COLUMN ""CompanionCount"" SET DEFAULT 0;");
            migrationBuilder.Sql(@"ALTER TABLE ""TravelApplications"" ALTER COLUMN ""HasCompanion""   SET DEFAULT false;");
            migrationBuilder.Sql(@"ALTER TABLE ""TravelApplications"" ALTER COLUMN ""CompanionCount"" SET DEFAULT 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""EventApplications""  ALTER COLUMN ""HasCompanion""   DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""EventApplications""  ALTER COLUMN ""CompanionCount"" DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""TravelApplications"" ALTER COLUMN ""HasCompanion""   DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""TravelApplications"" ALTER COLUMN ""CompanionCount"" DROP DEFAULT;");
        }
    }
}
