using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameFacilityConsecutiveAbsence : Migration
    {
        private static string RenameIfExists(string table, string from, string to) =>
            $@"DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '{table}' AND column_name = '{from}') THEN
                    ALTER TABLE ""{table}"" RENAME COLUMN ""{from}"" TO ""{to}"";
                END IF;
            END $$;";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(RenameIfExists("FacilityRegistrations", "ExcuseUsed", "ConsecutiveAbsenceUsed"));
            migrationBuilder.Sql(RenameIfExists("FacilityGroups", "ExcuseLimit", "ConsecutiveAbsenceLimit"));
            migrationBuilder.Sql(RenameIfExists("FacilityBranches", "ExcuseLimit", "ConsecutiveAbsenceLimit"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(RenameIfExists("FacilityRegistrations", "ConsecutiveAbsenceUsed", "ExcuseUsed"));
            migrationBuilder.Sql(RenameIfExists("FacilityGroups", "ConsecutiveAbsenceLimit", "ExcuseLimit"));
            migrationBuilder.Sql(RenameIfExists("FacilityBranches", "ConsecutiveAbsenceLimit", "ExcuseLimit"));
        }
    }
}
