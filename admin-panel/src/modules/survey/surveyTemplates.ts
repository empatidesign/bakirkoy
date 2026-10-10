export interface SurveyTemplate {
  id: string
  name: string
  category: string
  title: string
  description: string
  text: string
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'municipal-services',
    name: 'Belediye Hizmetleri Memnuniyeti',
    category: 'Belediye Hizmetleri',
    title: 'Belediye Hizmetleri Memnuniyet Anketi',
    description: 'Belediye hizmetlerinin kalitesini ölçmek ve vatandaş beklentilerini belirlemek amacıyla hazırlanmıştır.',
    text: `1. Belediyemizin genel hizmet kalitesinden memnun musunuz?
a) Evet
b) Hayır

[yıldız] Temizlik hizmetlerini puanlayın

[çoklu] Hangi belediye hizmetlerinden yararlandınız?
- Temizlik hizmetleri
- Sosyal yardım
- Park ve bahçeler
- Zabıta hizmetleri

[memnuniyet] Başvuru ve taleplerin sonuçlandırılma süresini değerlendiriniz

Belediye hizmetlerinin geliştirilmesi için önerilerinizi yazınız.`,
  },
  {
    id: 'event',
    name: 'Etkinlik Değerlendirme',
    category: 'Etkinlik',
    title: 'Etkinlik Değerlendirme Anketi',
    description: 'Etkinlik deneyimini ve katılımcı memnuniyetini değerlendirmek amacıyla hazırlanmıştır.',
    text: `[yıldız] Etkinliği genel olarak puanlayınız

[memnuniyet] Etkinlik içeriğinden ne kadar memnun kaldınız?

Etkinlik duyurusunu nereden gördünüz?
- Sosyal medya
- Belediye web sitesi
- SMS
- Yakınımdan duydum

Benzer etkinliklere tekrar katılmak ister misiniz?
a) Evet
b) Hayır

Gelecek etkinlikler için önerilerinizi yazınız.`,
  },
  {
    id: 'travel',
    name: 'Gezi Memnuniyeti',
    category: 'Gezi',
    title: 'Gezi Memnuniyet Anketi',
    description: 'Gezi organizasyonu, ulaşım ve rehberlik hizmetlerini değerlendirmek amacıyla hazırlanmıştır.',
    text: `[yıldız] Gezi organizasyonunu genel olarak puanlayınız

[memnuniyet] Ulaşım hizmetinden ne kadar memnun kaldınız?

[memnuniyet] Rehberlik hizmetini değerlendiriniz

Gezi programı yeterli miydi?
a) Evet
b) Hayır

Katılmak istediğiniz yeni gezi rotalarını yazınız.`,
  },
  {
    id: 'sports',
    name: 'Spor Tesisi ve Kursu',
    category: 'Spor',
    title: 'Spor Hizmetleri Memnuniyet Anketi',
    description: 'Spor tesisi, eğitmen ve kurs hizmetlerinin kalitesini ölçmek amacıyla hazırlanmıştır.',
    text: `[yıldız] Spor tesisinin genel durumunu puanlayınız

[memnuniyet] Eğitmenlerin ilgisini değerlendiriniz

[çoklu] Hangi spor hizmetlerinden yararlanıyorsunuz?
- Yüzme
- Fitness
- Takım sporları
- Çocuk spor kursları

Tesisi başkalarına tavsiye eder misiniz?
a) Evet
b) Hayır

Eklenmesini istediğiniz spor branşlarını yazınız.`,
  },
  {
    id: 'education',
    name: 'Eğitim ve Kurs',
    category: 'Eğitim',
    title: 'Eğitim ve Kurs Değerlendirme Anketi',
    description: 'Eğitim içeriği, eğitmen ve öğrenme ortamını değerlendirmek amacıyla hazırlanmıştır.',
    text: `[yıldız] Eğitimi genel olarak puanlayınız

[memnuniyet] Eğitim içeriğinin ihtiyaçlarınıza uygunluğunu değerlendiriniz

[katılım] Bu eğitim mesleki veya kişisel gelişimime katkı sağladı

Eğitmeni yeterli buldunuz mu?
a) Evet
b) Hayır

Yeni eğitimler için konu önerilerinizi yazınız.`,
  },
  {
    id: 'library',
    name: 'Kütüphane Kullanıcı Deneyimi',
    category: 'Kütüphane',
    title: 'Kütüphane Kullanıcı Memnuniyet Anketi',
    description: 'Kütüphane ortamı, kaynakları ve hizmet kalitesini değerlendirmek amacıyla hazırlanmıştır.',
    text: `[yıldız] Kütüphane deneyiminizi genel olarak puanlayınız

[memnuniyet] Kitap ve kaynak çeşitliliğini değerlendiriniz

[çoklu] Kütüphaneyi hangi amaçlarla kullanıyorsunuz?
- Kitap ödünç alma
- Ders çalışma
- İnternet erişimi
- Etkinliklere katılma

Çalışma alanlarını yeterli buluyor musunuz?
a) Evet
b) Hayır

Kütüphane için önerilerinizi yazınız.`,
  },
  {
    id: 'youth',
    name: 'Gençlik İhtiyaçları',
    category: 'Gençlik',
    title: 'Gençlik Hizmetleri İhtiyaç Anketi',
    description: 'Gençlerin belediye hizmetlerinden beklentilerini ve önceliklerini belirlemek amacıyla hazırlanmıştır.',
    text: `[çoklu] Hangi gençlik hizmetlerinden yararlanmak istersiniz?
- Eğitim ve atölye
- Spor etkinlikleri
- Kültür ve sanat
- Kariyer desteği
- Gönüllülük çalışmaları

Gençlik merkezlerini yeterli buluyor musunuz?
a) Evet
b) Hayır

[yıldız] Mevcut gençlik faaliyetlerini puanlayınız

Katılmak istediğiniz etkinlikleri ve projeleri yazınız.`,
  },
  {
    id: 'general',
    name: 'Genel Görüş ve Beklenti',
    category: 'Genel',
    title: 'Genel Görüş ve Beklenti Anketi',
    description: 'Vatandaşların genel memnuniyetini, görüşlerini ve öncelikli beklentilerini belirlemek amacıyla hazırlanmıştır.',
    text: `[yıldız] Belediyenin çalışmalarını genel olarak puanlayınız

Belediye hizmetleri hakkında yeterli bilgiye ulaşabiliyor musunuz?
a) Evet
b) Hayır

[çoklu] Öncelik verilmesini istediğiniz alanlar hangileridir?
- Ulaşım
- Çevre ve temizlik
- Sosyal hizmetler
- Kültür ve sanat
- Spor

Görüş ve önerilerinizi yazınız.`,
  },
]
