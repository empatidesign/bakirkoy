using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddManagedLegalDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CitizenKvkkText",
                table: "MobileAppConfigs",
                type: "character varying(20000)",
                maxLength: 20000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CitizenNotificationText",
                table: "MobileAppConfigs",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyKvkkText",
                table: "MobileAppConfigs",
                type: "character varying(20000)",
                maxLength: 20000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyNotificationText",
                table: "MobileAppConfigs",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyStaffKvkkText",
                table: "MobileAppConfigs",
                type: "character varying(20000)",
                maxLength: 20000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CompanyStaffNotificationText",
                table: "MobileAppConfigs",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "MobileAppConfigs",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-00000000c0f1"),
                columns: new[] { "CitizenKvkkText", "CitizenNotificationText", "CompanyKvkkText", "CompanyNotificationText", "CompanyStaffKvkkText", "CompanyStaffNotificationText" },
                values: new object[] { "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında; kimlik, iletişim, adres, başvuru, rezervasyon ve belediye hizmetlerinden yararlanma bilgileriniz Sultangazi Belediyesi tarafından veri sorumlusu sıfatıyla işlenmektedir.\n\nKişisel verileriniz; üyeliğinizin oluşturulması ve yönetilmesi, kimliğinizin doğrulanması, başvuru ve rezervasyon işlemlerinin yürütülmesi, belediye hizmetlerinin sunulması, güvenliğin sağlanması, talep ve şikâyetlerin sonuçlandırılması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.\n\nVerileriniz ilgili mevzuatta öngörülen süre boyunca güvenli şekilde saklanır. Kanuni zorunluluklar ve hizmetin yürütülmesi dışında üçüncü kişilerle paylaşılmaz; yetkili kamu kurumlarıyla yalnızca hukuki yükümlülükler kapsamında paylaşılabilir.\n\nKVKK'nın 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri öğrenme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı Sultangazi Belediyesinin resmî iletişim kanalları üzerinden iletebilirsiniz.", "Sultangazi Belediyesi; başvuru ve rezervasyon durumları, randevu hatırlatmaları, hizmet duyuruları, etkinlikler ve kullanıcı hesabınızla ilgili bilgilendirmeleri SMS, e-posta, telefon ve/veya uygulama içi bildirim kanalları üzerinden gönderebilir.\n\nBu izin hizmetin sunulması için zorunlu olmayan bilgilendirme ve duyuruları kapsar. Bildirim tercihlerinizi hesabınızın bildirim ayarlarından dilediğiniz zaman değiştirebilir veya izninizi geri çekebilirsiniz. Yasal veya işlemsel olarak gönderilmesi zorunlu bildirimler bu tercihten etkilenmez.", "6698 sayılı KVKK kapsamında firma yetkilisine ve firmaya ait kimlik, iletişim, vergi, adres, kampanya ve işlem bilgileri; firma kaydının oluşturulması, doğrulanması, kampanya ve hizmet süreçlerinin yürütülmesi, güvenliğin sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla Sultangazi Belediyesi tarafından işlenir. Veriler yalnızca mevzuatın izin verdiği hallerde yetkili kurum ve hizmet sağlayıcılarla paylaşılır. KVKK'nın 11. maddesindeki haklarınızı Belediyenin resmî iletişim kanallarından kullanabilirsiniz.", "Sultangazi Belediyesi; kampanya onayları, işlem bildirimleri, hizmet duyuruları ve hesap güvenliği bilgilendirmelerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla firmanıza iletebilir. Tercihinizi daha sonra bildirim ayarlarından değiştirebilirsiniz.", "6698 sayılı KVKK kapsamında firma personeline ait kimlik, iletişim, yetki ve işlem bilgileri; personel hesabının oluşturulması, yetkilendirme, kampanya işlemlerinin yürütülmesi, işlem güvenliği ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. KVKK'nın 11. maddesindeki haklarınızı Sultangazi Belediyesinin resmî iletişim kanallarından kullanabilirsiniz.", "Sultangazi Belediyesi; firma personeli hesabınızla ilgili güvenlik, işlem, kampanya ve hizmet bildirimlerini SMS, e-posta ve/veya uygulama içi bildirim yoluyla iletebilir. Tercihinizi daha sonra değiştirebilirsiniz." });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CitizenKvkkText",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "CitizenNotificationText",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "CompanyKvkkText",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "CompanyNotificationText",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "CompanyStaffKvkkText",
                table: "MobileAppConfigs");

            migrationBuilder.DropColumn(
                name: "CompanyStaffNotificationText",
                table: "MobileAppConfigs");
        }
    }
}
