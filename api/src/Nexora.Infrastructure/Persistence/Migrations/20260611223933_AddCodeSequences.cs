using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    public partial class AddCodeSequences : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE SEQUENCE event_application_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
            migrationBuilder.Sql("CREATE SEQUENCE event_qr_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");

            migrationBuilder.Sql("""
                DO $$
                DECLARE cnt bigint;
                BEGIN
                    SELECT COUNT(*) INTO cnt FROM "EventApplications";
                    IF cnt > 0 THEN
                        PERFORM setval('event_application_code_seq', cnt);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                DECLARE cnt bigint;
                BEGIN
                    SELECT COUNT(*) INTO cnt FROM "EventQrCodes";
                    IF cnt > 0 THEN
                        PERFORM setval('event_qr_code_seq', cnt);
                    END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS event_application_code_seq;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS event_qr_code_seq;");
        }
    }
}
