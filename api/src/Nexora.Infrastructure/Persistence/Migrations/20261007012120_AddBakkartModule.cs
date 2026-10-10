using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBakkartModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BakkartApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackingNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    EncryptedFullName = table.Column<string>(type: "text", nullable: false),
                    EncryptedTckn = table.Column<string>(type: "text", nullable: false),
                    TcknHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TcknLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    EncryptedPhone = table.Column<string>(type: "text", nullable: false),
                    PhoneLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CardType = table.Column<int>(type: "integer", nullable: false),
                    DeliveryType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DocumentsJson = table.Column<string>(type: "jsonb", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ReviewedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CardId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BakkartApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BakkartCards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: true),
                    CardNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CardType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    BlockReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BakkartCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BakkartCards_BakkartApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "BakkartApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BakkartTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CardId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    AmountDelta = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    PointsDelta = table.Column<int>(type: "integer", nullable: false),
                    BalanceAfter = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    PointsAfter = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PerformedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BakkartTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BakkartTransactions_BakkartCards_CardId",
                        column: x => x.CardId,
                        principalTable: "BakkartCards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "MobileAppConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-00000000c0f1"),
                columns: new[] { "CitizenKvkkText", "CitizenNotificationText", "CompanyKvkkText", "CompanyNotificationText", "CompanyStaffKvkkText", "CompanyStaffNotificationText", "OnboardingImageUrls" },
                values: new object[] { "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında; kimlik, iletişim, adres, başvuru, rezervasyon ve belediye hizmetlerinden yararlanma bilgileriniz Bakırköy Belediyesi tarafından veri sorumlusu sıfatıyla işlenmektedir.\n\nKişisel verileriniz; üyeliğinizin oluşturulması ve yönetilmesi, kimliğinizin doğrulanması, başvuru ve rezervasyon işlemlerinin yürütülmesi, belediye hizmetlerinin sunulması, güvenliğin sağlanması, talep ve şikâyetlerin sonuçlandırılması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.\n\nVerileriniz ilgili mevzuatta öngörülen süre boyunca güvenli şekilde saklanır. Kanuni zorunluluklar ve hizmetin yürütülmesi dışında üçüncü kişilerle paylaşılmaz; yetkili kamu kurumlarıyla yalnızca hukuki yükümlülükler kapsamında paylaşılabilir.\n\nKVKK'nın 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri öğrenme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı Bakırköy Belediyesinin resmî iletişim kanalları üzerinden iletebilirsiniz.", "Bakırköy Belediyesi; başvuru ve rezervasyon durumları, randevu hatırlatmaları, hizmet duyuruları, etkinlikler ve kullanıcı hesabınızla ilgili bilgilendirmeleri SMS, e-posta, telefon ve/veya uygulama içi bildirim kanalları üzerinden gönderebilir.\n\nBu izin hizmetin sunulması için zorunlu olmayan bilgilendirme ve duyuruları kapsar. Bildirim tercihlerinizi hesabınızın bildirim ayarlarından dilediğiniz zaman değiştirebilir veya izninizi geri çekebilirsiniz. Yasal veya işlemsel olarak gönderilmesi zorunlu bildirimler bu tercihten etkilenmez.", "6698 sayılı KVKK kapsamında firma yetkilisine ve firmaya ait kimlik, iletişim, vergi, adres, kampanya ve işlem bilgileri; firma kaydının oluşturulması, doğrulanması, kampanya ve hizmet süreçlerinin yürütülmesi, güvenliğin sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla Bakırköy Belediyesi tarafından işlenir. Veriler yalnızca mevzuatın izin verdiği hallerde yetkili kurum ve hizmet sağlayıcılarla paylaşılır. KVKK'nın 11. maddesindeki haklarınızı Belediyenin resmî iletişim kanallarından kullanabilirsiniz.", "Bakırköy Belediyesi; kampanya onayları, işlem bildirimleri, hizmet duyuruları ve hesap güvenliği bilgilendirmelerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla firmanıza iletebilir. Tercihinizi daha sonra bildirim ayarlarından değiştirebilirsiniz.", "6698 sayılı KVKK kapsamında firma personeline ait kimlik, iletişim, yetki ve işlem bilgileri; personel hesabının oluşturulması, yetkilendirme, kampanya işlemlerinin yürütülmesi, işlem güvenliği ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. KVKK'nın 11. maddesindeki haklarınızı Bakırköy Belediyesinin resmî iletişim kanallarından kullanabilirsiniz.", "Bakırköy Belediyesi; firma personeli hesabınızla ilgili güvenlik, işlem, kampanya ve hizmet bildirimlerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla iletebilir. Tercihinizi daha sonra değiştirebilirsiniz.", new List<string>() });

            migrationBuilder.CreateIndex(
                name: "IX_BakkartApplications_AppliedAt",
                table: "BakkartApplications",
                column: "AppliedAt");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartApplications_ParticipantId",
                table: "BakkartApplications",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartApplications_Status",
                table: "BakkartApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartApplications_TcknHash",
                table: "BakkartApplications",
                column: "TcknHash");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartApplications_TrackingNo",
                table: "BakkartApplications",
                column: "TrackingNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BakkartCards_ApplicationId",
                table: "BakkartCards",
                column: "ApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BakkartCards_CardNo",
                table: "BakkartCards",
                column: "CardNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BakkartCards_ParticipantId",
                table: "BakkartCards",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartCards_Status",
                table: "BakkartCards",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartTransactions_CardId",
                table: "BakkartTransactions",
                column: "CardId");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartTransactions_OccurredAt",
                table: "BakkartTransactions",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_BakkartTransactions_Type",
                table: "BakkartTransactions",
                column: "Type");

            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS bakkart_application_tracking_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS bakkart_card_no_seq START 1 INCREMENT 1 MINVALUE 1 NO CYCLE;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS bakkart_application_tracking_seq;");
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS bakkart_card_no_seq;");

            migrationBuilder.DropTable(
                name: "BakkartTransactions");

            migrationBuilder.DropTable(
                name: "BakkartCards");

            migrationBuilder.DropTable(
                name: "BakkartApplications");

            migrationBuilder.UpdateData(
                table: "MobileAppConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-00000000c0f1"),
                columns: new[] { "CitizenKvkkText", "CitizenNotificationText", "CompanyKvkkText", "CompanyNotificationText", "CompanyStaffKvkkText", "CompanyStaffNotificationText", "OnboardingImageUrls" },
                values: new object[] { "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında; kimlik, iletişim, adres, başvuru, rezervasyon ve belediye hizmetlerinden yararlanma bilgileriniz Sultangazi Belediyesi tarafından veri sorumlusu sıfatıyla işlenmektedir.\n\nKişisel verileriniz; üyeliğinizin oluşturulması ve yönetilmesi, kimliğinizin doğrulanması, başvuru ve rezervasyon işlemlerinin yürütülmesi, belediye hizmetlerinin sunulması, güvenliğin sağlanması, talep ve şikâyetlerin sonuçlandırılması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.\n\nVerileriniz ilgili mevzuatta öngörülen süre boyunca güvenli şekilde saklanır. Kanuni zorunluluklar ve hizmetin yürütülmesi dışında üçüncü kişilerle paylaşılmaz; yetkili kamu kurumlarıyla yalnızca hukuki yükümlülükler kapsamında paylaşılabilir.\n\nKVKK'nın 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri öğrenme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı Sultangazi Belediyesinin resmî iletişim kanalları üzerinden iletebilirsiniz.", "Sultangazi Belediyesi; başvuru ve rezervasyon durumları, randevu hatırlatmaları, hizmet duyuruları, etkinlikler ve kullanıcı hesabınızla ilgili bilgilendirmeleri SMS, e-posta, telefon ve/veya uygulama içi bildirim kanalları üzerinden gönderebilir.\n\nBu izin hizmetin sunulması için zorunlu olmayan bilgilendirme ve duyuruları kapsar. Bildirim tercihlerinizi hesabınızın bildirim ayarlarından dilediğiniz zaman değiştirebilir veya izninizi geri çekebilirsiniz. Yasal veya işlemsel olarak gönderilmesi zorunlu bildirimler bu tercihten etkilenmez.", "6698 sayılı KVKK kapsamında firma yetkilisine ve firmaya ait kimlik, iletişim, vergi, adres, kampanya ve işlem bilgileri; firma kaydının oluşturulması, doğrulanması, kampanya ve hizmet süreçlerinin yürütülmesi, güvenliğin sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla Sultangazi Belediyesi tarafından işlenir. Veriler yalnızca mevzuatın izin verdiği hallerde yetkili kurum ve hizmet sağlayıcılarla paylaşılır. KVKK'nın 11. maddesindeki haklarınızı Belediyenin resmî iletişim kanallarından kullanabilirsiniz.", "Sultangazi Belediyesi; kampanya onayları, işlem bildirimleri, hizmet duyuruları ve hesap güvenliği bilgilendirmelerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla firmanıza iletebilir. Tercihinizi daha sonra bildirim ayarlarından değiştirebilirsiniz.", "6698 sayılı KVKK kapsamında firma personeline ait kimlik, iletişim, yetki ve işlem bilgileri; personel hesabının oluşturulması, yetkilendirme, kampanya işlemlerinin yürütülmesi, işlem güvenliği ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. KVKK'nın 11. maddesindeki haklarınızı Sultangazi Belediyesinin resmî iletişim kanallarından kullanabilirsiniz.", "Sultangazi Belediyesi; firma personeli hesabınızla ilgili güvenlik, işlem, kampanya ve hizmet bildirimlerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla iletebilir. Tercihinizi daha sonra değiştirebilirsiniz.", new List<string>() });
        }
    }
}
