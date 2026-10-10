using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSedaApplicationCodeSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // KÖK NEDEN DÜZELTMESİ (2026-07-22 — 10K SEDA ölçekleme testi):
            // SedaApplicationRepository.NextCodeNumberAsync önceden MAX+1 tarama
            // yapıyordu; yüksek eşzamanlılıkta yarış durumu (aynı kodun birden
            // fazla istek tarafından üretilmesi) IX_SedaApplications_Code UNIQUE
            // index'inde 23505 hatasına yol açıyordu (11.000 eşzamanlı başvuru
            // testinde ~%86 başarısızlık). EventApplications'ta aynı sorun için
            // kullanılan Postgres SEQUENCE deseni (atomik nextval()) burada da
            // uygulandı.
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS seda_application_code_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");

            migrationBuilder.Sql("""
                DO $$
                DECLARE mx bigint;
                BEGIN
                    SELECT COALESCE(MAX((regexp_replace("Code", '[^0-9]', '', 'g'))::bigint), 0)
                    INTO mx
                    FROM "SedaApplications";
                    IF mx > 0 THEN
                        PERFORM setval('seda_application_code_seq', mx);
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS seda_application_code_seq;");
        }
    }
}
