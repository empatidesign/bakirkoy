using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityGroupEntitlementModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EntitlementModel",
                table: "FacilityGroups",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "fixed_calendar");

            // V01: mevcut recurring gruplar eskiden otomatik terfide "bugün + PeriodMonths" tam kişisel
            // süre veriyordu. Yeni alanın varsayılanı (fixed_calendar) bu davranışı bozardı; bu yüzden
            // mevcut recurring gruplar açıkça personal_duration'a backfill edilir. date_range/diğerleri
            // fixed_calendar kalır. Kayıtların saklı MembershipStart/PeriodEnd değerlerine dokunulmaz.
            migrationBuilder.Sql(
                "UPDATE \"FacilityGroups\" SET \"EntitlementModel\" = 'personal_duration' WHERE \"PeriodType\" = 'recurring';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EntitlementModel",
                table: "FacilityGroups");
        }
    }
}
