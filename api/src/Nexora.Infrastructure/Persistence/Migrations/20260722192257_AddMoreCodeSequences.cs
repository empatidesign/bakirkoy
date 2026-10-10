using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMoreCodeSequences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // KÖK NEDEN DÜZELTMESİ (2026-07-22 — SEDA'da bulunan MAX+1 tarama race
            // condition hatasının önleyici genellemesi): Events, Sessions, Travels ve
            // TravelApplications repository'lerindeki NextCodeNumberAsync de aynı
            // hatalı deseni kullanıyordu (yüksek eşzamanlılıkta 23505 UNIQUE
            // violation riski). EventApplications'ta önceden kullanılmış olan
            // Postgres SEQUENCE deseni buraya da uygulandı.
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS event_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS session_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS travel_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS travel_application_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");

            migrationBuilder.Sql("""
                DO $$
                DECLARE mx bigint;
                BEGIN
                    SELECT COALESCE(MAX((regexp_replace("Code", '[^0-9]', '', 'g'))::bigint), 0) INTO mx FROM "Events";
                    IF mx > 0 THEN PERFORM setval('event_code_seq', mx); END IF;

                    SELECT COALESCE(MAX((regexp_replace("Code", '[^0-9]', '', 'g'))::bigint), 0) INTO mx FROM "Sessions";
                    IF mx > 0 THEN PERFORM setval('session_code_seq', mx); END IF;

                    SELECT COALESCE(MAX((regexp_replace("Code", '[^0-9]', '', 'g'))::bigint), 0) INTO mx FROM "Travels";
                    IF mx > 0 THEN PERFORM setval('travel_code_seq', mx); END IF;

                    SELECT COALESCE(MAX((regexp_replace("Code", '[^0-9]', '', 'g'))::bigint), 0) INTO mx FROM "TravelApplications";
                    IF mx > 0 THEN PERFORM setval('travel_application_code_seq', mx); END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS event_code_seq;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS session_code_seq;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS travel_code_seq;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS travel_application_code_seq;");
        }
    }
}
