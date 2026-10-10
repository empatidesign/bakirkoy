// Merkezi KVKK / Bildirim İzni metin kaynağı — üç ayrı ConsentGate (vatandaş, firma, firma
// personeli) ve login ekranlarındaki "metni görüntüle" linki aynı kaynağı kullanır, böylece
// metinler birbirinden sapmaz ve girişten ÖNCE de (login ekranında link olarak) okunabilir olur.
//
// Kullanıcı isteği (2026-08-02): KVKK metni ilk girişte, login olduktan SONRA (ConsentGate modalı)
// geliyordu — girişten önce, login ekranında da görülebilir/seçilebilir olmalı. Login ekranlarına
// bu metinleri açan bir "KVKK Aydınlatma Metni" linki eklendi (bkz. LoginPage.tsx,
// CompanyLoginPage.tsx, CompanyStaffLoginPage.tsx + yeni LegalTextModal.tsx). Zorunlu onay akışı
// (ConsentGate, ilk girişten sonra checkbox ile onay alınması) DEĞİŞMEDİ — bu, KVKK'nın ilgili
// kişiye "veri işlenmeden önce" bilgi verilmesi ilkesine ek bir katman, onayın kendisinin yerini
// tutmuyor.

export const CITIZEN_KVKK_TEXT = `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Bakırköy Belediyesi
tarafından sunulan hizmetlerden yararlanabilmeniz için kimlik, iletişim ve kullanım verileriniz
işlenmekte ve saklanmaktadır. Verileriniz yalnızca ilgili belediye hizmetlerinin yürütülmesi
amacıyla kullanılır, mevzuatın izin verdiği durumlar dışında üçüncü kişilerle paylaşılmaz.
Kişisel Verilerin Korunması Kanunu kapsamındaki haklarınızı (bilgi talep etme, düzeltme,
silme vb.) her zaman kullanabilirsiniz.`

export const CITIZEN_NOTIFICATION_TEXT = `Bakırköy Belediyesi hizmetlerine ilişkin bildirimler (başvuru durumu, etkinlik
hatırlatmaları, kampanyalar ve duyurular) SMS, e-posta ve/veya push bildirimi (uygulama içi
anlık bildirim) kanalları üzerinden tarafınıza iletilebilir. Bu onayı verdikten sonra, hangi
kanallardan bildirim almak istediğinizi Ayarlar > Bildirim Tercihleri sayfasından
dilediğiniz zaman değiştirebilirsiniz.`

export const COMPANY_KVKK_TEXT = `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Bakırköy Belediyesi
tarafından sunulan hizmetlerden yararlanabilmeniz için firma ve yetkili bilgileriniz
işlenmekte ve saklanmaktadır. Verileriniz yalnızca ilgili belediye hizmetlerinin yürütülmesi
amacıyla kullanılır, mevzuatın izin verdiği durumlar dışında üçüncü kişilerle paylaşılmaz.`

export const COMPANY_NOTIFICATION_TEXT = `Bakırköy Belediyesi, kampanya onayları, ödeme/kullanım bildirimleri ve duyurular
gibi hizmetlere ilişkin bilgileri SMS, e-posta ve/veya push bildirimi (uygulama içi anlık
bildirim) kanalları üzerinden firmanıza iletebilir.`

export const COMPANY_STAFF_KVKK_TEXT = `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Bakırköy Belediyesi
tarafından sunulan hizmetlerden yararlanabilmeniz için kimlik ve iletişim bilgileriniz
işlenmekte ve saklanmaktadır. Verileriniz yalnızca ilgili belediye hizmetlerinin yürütülmesi
amacıyla kullanılır, mevzuatın izin verdiği durumlar dışında üçüncü kişilerle paylaşılmaz.`

export const COMPANY_STAFF_NOTIFICATION_TEXT = `Bakırköy Belediyesi, kampanya ve kullanım bildirimleri gibi hizmetlere ilişkin
bilgileri SMS, e-posta ve/veya push bildirimi (uygulama içi anlık bildirim) kanalları
üzerinden tarafınıza iletebilir.`
