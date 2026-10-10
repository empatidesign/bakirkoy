using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Application.Features.Surveys;

/// <summary>
/// Doküman 02 §6 — hazır anket şablonları. Admin panelde "Şablondan Anket Oluştur"
/// akışında kullanılır; şablonlar koda gömülüdür (veri tabanı gerektirmez).
/// </summary>
public static class SurveyTemplateCatalog
{
    private static SurveyTemplateQuestionDto Satisfaction(string q) =>
        new("satisfaction", q, null, true, [], null);

    private static SurveyTemplateQuestionDto Choice(string q, params string[] options) =>
        new("multiple_choice", q, null, true, [.. options], null);

    private static SurveyTemplateQuestionDto MultiChoice(string q, params string[] options) =>
        new("checkbox", q, null, true, [.. options], null);

    private static SurveyTemplateQuestionDto YesNo(string q) =>
        new("yes_no", q, null, true, [], null);

    private static SurveyTemplateQuestionDto Text(string q) =>
        new("text", q, null, false, [], null);

    private static SurveyTemplateQuestionDto Nps(string q) =>
        new("scale", q, "0 = hiç önermem, 10 = kesinlikle öneririm", true, [],
            new SurveyQuestionConfigDto(0, 10, "Hiç önermem", "Kesinlikle öneririm", null));

    // Kullanıcı isteği (2026-09-01): "tüm belediye hizmetlerinden puanlayacağı ... 1 den 5 e
    // kadar vs farklı soru türlerinin olduğu" anketler. Aşağıdaki yardımcılar, şablonların
    // her soru tipini (yıldız, emoji, beğeni, katılım, ölçek, tekli/çoklu seçim, evet-hayır,
    // serbest metin) kullanabilmesi için eklendi.

    /// <summary>1-5 yıldızlı puanlama.</summary>
    private static SurveyTemplateQuestionDto Stars5(string q, string? desc = null) =>
        new("rating", q, desc ?? "1 = çok kötü, 5 = çok iyi", true, [], new SurveyQuestionConfigDto(null, null, null, null, 5));

    /// <summary>1-10 yıldızlı ayrıntılı puanlama.</summary>
    private static SurveyTemplateQuestionDto Stars10(string q) =>
        new("rating", q, "1 = çok kötü, 10 = mükemmel", true, [], new SurveyQuestionConfigDto(null, null, null, null, 10));

    /// <summary>Emoji ile hızlı duygu ölçümü.</summary>
    private static SurveyTemplateQuestionDto Emoji(string q) =>
        new("emoji_rating", q, "Size en uygun ifadeyi seçin", true, [], null);

    /// <summary>"Beğeniyorum / Beğenmiyorum" ikili tercih.</summary>
    private static SurveyTemplateQuestionDto Like(string q) =>
        new("like_dislike", q, null, true, [], null);

    /// <summary>Katılıyorum-katılmıyorum ölçeği.</summary>
    private static SurveyTemplateQuestionDto Agree(string q) =>
        new("agreement", q, null, true, [], null);

    /// <summary>Serbest aralıklı ölçek (ör. 1-5 öncelik).</summary>
    private static SurveyTemplateQuestionDto Scale(string q, int min, int max, string minLabel, string maxLabel) =>
        new("scale", q, $"{min} = {minLabel}, {max} = {maxLabel}", true, [],
            new SurveyQuestionConfigDto(min, max, minLabel, maxLabel, null));

    private static SurveyTemplateQuestionDto ChoiceOptional(string q, params string[] options) =>
        new("multiple_choice", q, null, false, [.. options], null);

    private static SurveyTemplateQuestionDto TextRequired(string q) =>
        new("text", q, null, true, [], null);

    public static readonly List<SurveyTemplateDto> All =
    [
        new("belediye-memnuniyet", "Belediye Memnuniyet Anketi",
            "İlçe genelinde belediye hizmetlerinden duyulan memnuniyeti ölçer.",
            "Belediye Hizmetleri", "Genel", "satisfaction", 6,
            [
                Satisfaction("Belediyemizin genel hizmet kalitesinden ne kadar memnunsunuz?"),
                Satisfaction("Temizlik hizmetlerinden memnuniyetiniz nedir?"),
                Satisfaction("Park ve yeşil alanlardan memnuniyetiniz nedir?"),
                Satisfaction("Ulaşım ve yol hizmetlerinden memnuniyetiniz nedir?"),
                Satisfaction("Sosyal yardım hizmetlerinden memnuniyetiniz nedir?"),
                Nps("Bakırköy Belediyesi'ni bir tanıdığınıza önerir misiniz?"),
                Text("Belediyemizden beklentilerinizi yazabilirsiniz."),
            ]),

        new("mahalle-sorun-tespit", "Mahalle Sorun Tespit Anketi",
            "Mahalle bazında öncelikli sorunları ve ihtiyaçları belirler.",
            "Belediye Hizmetleri", "Mahalle", "neighborhood", 5,
            [
                MultiChoice("Mahallenizde en çok hangi konularda sorun yaşıyorsunuz?",
                    "Temizlik", "Yol ve kaldırım", "Aydınlatma", "Otopark", "Gürültü",
                    "Sahipsiz hayvanlar", "Güvenlik", "Yeşil alan eksikliği", "Altyapı"),
                Choice("Bu sorunlardan hangisi sizin için en önceliklidir?",
                    "Temizlik", "Yol ve kaldırım", "Aydınlatma", "Otopark", "Güvenlik", "Diğer"),
                Satisfaction("Mahallenizde yaşamaktan genel olarak ne kadar memnunsunuz?"),
                YesNo("Son 1 yıl içinde belediyeye bu konularda talep ilettiniz mi?"),
                Text("Mahallenizle ilgili eklemek istedikleriniz."),
            ]),

        new("temizlik", "Temizlik Hizmetleri Anketi",
            "Çöp toplama, süpürme ve konteyner hizmetlerini değerlendirir.",
            "Belediye Hizmetleri", "Temizlik", "topic", 4,
            [
                Satisfaction("Çöp toplama hizmetinden memnuniyetiniz nedir?"),
                Satisfaction("Cadde ve sokak süpürme hizmetinden memnuniyetiniz nedir?"),
                Choice("Çöp konteynerlerinin sayısı yeterli mi?", "Yeterli", "Kısmen yeterli", "Yetersiz"),
                MultiChoice("Temizlikte hangi konularda iyileştirme bekliyorsunuz?",
                    "Toplama sıklığı", "Konteyner temizliği", "Moloz toplama", "Pazar sonrası temizlik", "İlaçlama"),
                Text("Temizlik hizmetleri hakkında görüşleriniz."),
            ]),

        new("ulasim", "Ulaşım ve Yol Anketi",
            "Yol, kaldırım, otopark ve ulaşım altyapısını değerlendirir.",
            "Belediye Hizmetleri", "Ulaşım", "topic", 4,
            [
                Satisfaction("Mahallenizdeki yolların durumundan memnuniyetiniz nedir?"),
                Satisfaction("Kaldırımların yaya kullanımına uygunluğundan memnuniyetiniz nedir?"),
                Choice("Otopark ihtiyacınız karşılanıyor mu?", "Evet", "Kısmen", "Hayır"),
                MultiChoice("Hangi ulaşım sorunlarını yaşıyorsunuz?",
                    "Yol çukurları", "Trafik yoğunluğu", "Toplu taşıma yetersizliği", "Otopark", "Yaya güvenliği"),
                Text("Ulaşımla ilgili önerileriniz."),
            ]),

        new("park-bahce", "Park ve Bahçeler Anketi",
            "Park, oyun alanı ve yeşil alan hizmetlerini değerlendirir.",
            "Belediye Hizmetleri", "Park ve Bahçeler", "topic", 4,
            [
                Satisfaction("Mahallenizdeki park ve yeşil alanlardan memnuniyetiniz nedir?"),
                Choice("Parkları hangi sıklıkla kullanıyorsunuz?", "Her gün", "Haftada birkaç kez", "Ayda birkaç kez", "Hiç kullanmıyorum"),
                MultiChoice("Parklarda hangi eksiklikleri görüyorsunuz?",
                    "Oyun grupları", "Aydınlatma", "Bank ve gölgelik", "Temizlik", "Spor aletleri", "Güvenlik"),
                Text("Park ve bahçelerle ilgili önerileriniz."),
            ]),

        new("sosyal-yardim", "Sosyal Yardım Hizmetleri Anketi",
            "Sosyal yardım süreçlerine erişim ve memnuniyeti ölçer.",
            "Belediye Hizmetleri", "Sosyal Yardım", "topic", 5,
            [
                YesNo("Belediyemizin sosyal yardım hizmetlerinden yararlandınız mı?"),
                Satisfaction("Başvuru sürecinden memnuniyetiniz nedir?"),
                Satisfaction("Yardımların zamanında ulaşmasından memnuniyetiniz nedir?"),
                MultiChoice("Hangi sosyal yardımlara ihtiyaç duyuyorsunuz?",
                    "Gıda", "Yakacak", "Eğitim desteği", "Sağlık desteği", "Engelli desteği", "Yaşlı bakım"),
                Text("Sosyal yardım hizmetleri hakkında görüşleriniz."),
            ]),

        new("veterinerlik", "Veterinerlik Hizmetleri Anketi",
            "Sahipsiz hayvanlar ve veteriner hizmetlerini değerlendirir.",
            "Belediye Hizmetleri", "Veterinerlik", "topic", 3,
            [
                Satisfaction("Sahipsiz hayvanlara yönelik hizmetlerden memnuniyetiniz nedir?"),
                MultiChoice("Hangi konularda çalışma yapılmasını istersiniz?",
                    "Kısırlaştırma", "Mama noktaları", "Barınak kapasitesi", "Yaralı hayvan müdahalesi", "Sahiplendirme"),
                Text("Görüş ve önerileriniz."),
            ]),

        new("kultur-etkinlik", "Kültür ve Etkinlik Anketi",
            "Kültürel etkinlik beklenti ve memnuniyetini ölçer.",
            "Etkinlik", "Kültür", "post_event", 4,
            [
                Satisfaction("Belediyemizin kültür ve etkinliklerinden genel memnuniyetiniz nedir?"),
                MultiChoice("Hangi etkinlik türlerini istersiniz?",
                    "Konser", "Tiyatro", "Söyleşi", "Sinema", "Çocuk etkinlikleri", "Spor etkinlikleri", "Gezi"),
                Choice("Etkinlikleri hangi kanaldan duyuyorsunuz?",
                    "Mobil uygulama", "Sosyal medya", "Afiş", "Tanıdık", "Muhtarlık"),
                Text("Etkinliklerle ilgili önerileriniz."),
            ]),

        new("genclik", "Gençlik Hizmetleri Anketi",
            "Gençlere yönelik hizmet ve alan ihtiyaçlarını ölçer.",
            "Gençlik", "Gençlik", "topic", 4,
            [
                Satisfaction("Gençlere yönelik hizmetlerden memnuniyetiniz nedir?"),
                MultiChoice("Hangi alanlarda destek beklersiniz?",
                    "Kurs ve eğitim", "Kariyer/staj", "Spor tesisi", "Etüt ve kütüphane", "Sosyal alan", "Girişimcilik"),
                Choice("Kütüphane/etüt salonlarını kullanıyor musunuz?", "Düzenli", "Ara sıra", "Hiç"),
                Text("Gençlik hizmetleri hakkında önerileriniz."),
            ]),

        new("yasli-engelli", "Yaşlı ve Engelli Hizmetleri Anketi",
            "Yaşlı ve engelli bireylere yönelik hizmetleri değerlendirir.",
            "Belediye Hizmetleri", "Engelli Hizmetleri", "topic", 4,
            [
                Satisfaction("Yaşlı ve engelli bireylere yönelik hizmetlerden memnuniyetiniz nedir?"),
                MultiChoice("Hangi hizmetlere ihtiyaç duyuyorsunuz?",
                    "Evde bakım", "Ulaşım desteği", "Sağlık desteği", "Sosyal etkinlik", "Erişilebilirlik düzenlemeleri"),
                Choice("Mahallenizde erişilebilirlik (rampa, kaldırım) yeterli mi?", "Yeterli", "Kısmen", "Yetersiz"),
                Text("Görüş ve önerileriniz."),
            ]),

        new("hizli-nabiz", "Hızlı Nabız Anketi",
            "2-3 soruluk kısa saha nabız ölçümü.",
            "Genel", "Genel", "pulse", 2,
            [
                Satisfaction("Bugün itibarıyla belediye hizmetlerinden memnuniyetiniz nedir?"),
                Choice("Şu an mahallenizdeki en acil sorun nedir?",
                    "Temizlik", "Yol", "Aydınlatma", "Güvenlik", "Otopark", "Diğer"),
                Text("Eklemek istediğiniz bir konu var mı?"),
            ]),

        new("etkinlik-sonrasi", "Etkinlik Sonrası Memnuniyet Anketi",
            "Konser, seminer, gezi ve spor etkinlikleri sonrası memnuniyet ölçümü.",
            "Etkinlik", "Etkinlik", "post_event", 3,
            [
                Satisfaction("Etkinlikten genel memnuniyetiniz nedir?"),
                Satisfaction("Organizasyon ve düzenden memnuniyetiniz nedir?"),
                Nps("Bu etkinliği bir tanıdığınıza önerir misiniz?"),
                Text("Etkinlikle ilgili görüşleriniz."),
            ]),

        // ------------------------------------------------------------------
        // Kullanıcı isteği (2026-09-01): "sultangazi belediyesi ile ilgili hizmetlerden
        // memnun, etkinlikler katılım vs gibi genel 10 farklı birbirinden anket düzenle,
        // tüm belediye hizmetlerinden puanlayacağı şıkların olduğu, beğeniyorum, 1'den 5'e
        // kadar vs farklı soru türlerinin olduğu bir anket düzenle."
        // Aşağıdaki 10 şablon birbirinden farklı konu ve farklı soru tipi karışımı kullanır.
        // ------------------------------------------------------------------

        new("hizmet-karnesi-2026", "Belediye Hizmet Karnesi (Tüm Hizmetler)",
            "Tüm belediye hizmetlerinin 1-5 yıldızla tek tek puanlandığı kapsamlı karne anketi.",
            "Belediye Hizmetleri", "Genel", "satisfaction", 8,
            [
                Stars5("Temizlik ve çöp toplama hizmetlerini puanlayın"),
                Stars5("Yol, kaldırım ve asfalt hizmetlerini puanlayın"),
                Stars5("Park, bahçe ve yeşil alanları puanlayın"),
                Stars5("Sokak aydınlatmasını puanlayın"),
                Stars5("Sosyal yardım hizmetlerini puanlayın"),
                Stars5("Kültür, sanat ve etkinlikleri puanlayın"),
                Stars5("Spor tesisleri ve kurslarını puanlayın"),
                Stars5("Zabıta ve denetim hizmetlerini puanlayın"),
                Stars5("Veterinerlik ve sokak hayvanları hizmetlerini puanlayın"),
                Stars5("Belediye personelinin ilgi ve nezaketini puanlayın"),
                Choice("Bu hizmetlerden hangisi sizin için EN ÖNCELİKLİ iyileştirme alanıdır?",
                    "Temizlik", "Yol ve kaldırım", "Park ve yeşil alan", "Aydınlatma",
                    "Sosyal yardım", "Kültür ve etkinlik", "Spor", "Zabıta", "Veterinerlik", "Diğer"),
                Nps("Bakırköy Belediyesi'ni bir tanıdığınıza önerir misiniz?"),
                Text("Eklemek istedikleriniz."),
            ]),

        new("etkinlik-katilim-2026", "Etkinlik Katılımı ve Beğeni Anketi",
            "Vatandaşın etkinliklere katılım sıklığı, tercihleri ve beğenisini ölçer.",
            "Etkinlik", "Etkinlik", "standard", 6,
            [
                Choice("Belediye etkinliklerine ne sıklıkla katılıyorsunuz?",
                    "Her hafta", "Ayda birkaç kez", "Ayda bir", "Yılda birkaç kez", "Hiç katılmadım"),
                MultiChoice("Hangi tür etkinliklere katılmayı seversiniz?",
                    "Konser ve müzik", "Tiyatro", "Sinema", "Söyleşi ve seminer", "Spor turnuvası",
                    "Çocuk etkinlikleri", "Gezi ve piknik", "Festival ve şenlik", "Kurs ve atölye"),
                Like("Son katıldığınız belediye etkinliğini beğendiniz mi?"),
                Stars5("Etkinliklerin genel kalitesini puanlayın"),
                Stars5("Etkinlik duyurularının size ulaşmasını puanlayın"),
                Choice("Etkinlikleri en çok hangi kanaldan duyuyorsunuz?",
                    "Belediye mobil uygulaması", "Sosyal medya", "SMS", "Afiş ve pankart",
                    "Komşu ve tanıdık", "Muhtarlık", "Hiç duymuyorum"),
                Choice("Etkinlikler için en uygun zaman hangisi?",
                    "Hafta içi gündüz", "Hafta içi akşam", "Cumartesi", "Pazar"),
                Agree("Etkinliklerin mahalleme yeterince yakın yerlerde yapıldığını düşünüyorum"),
                Text("Görmek istediğiniz etkinlik türleri nelerdir?"),
            ]),

        new("temizlik-detay-2026", "Temizlik ve Çevre Detaylı Anketi",
            "Çöp toplama sıklığı, konteyner ve çevre temizliğini ayrıntılı ölçer.",
            "Belediye Hizmetleri", "Temizlik", "satisfaction", 5,
            [
                Stars5("Sokağınızın genel temizliğini puanlayın"),
                Choice("Çöpler mahallenizde ne sıklıkla toplanıyor?",
                    "Her gün", "İki günde bir", "Haftada birkaç kez", "Haftada bir", "Bilmiyorum"),
                Agree("Çöp toplama saatleri benim için uygun"),
                MultiChoice("Çevre temizliğinde en çok hangi sorunu yaşıyorsunuz?",
                    "Konteyner yetersiz", "Konteyner kirli/kokulu", "Çöpler geç toplanıyor",
                    "Sokak süpürülmüyor", "Moloz ve hafriyat", "Sorun yaşamıyorum"),
                Emoji("Mahallenizin temizliği sizi nasıl hissettiriyor?"),
                YesNo("Geri dönüşüm kutusu kullanıyor musunuz?"),
                Scale("Belediyenin çevre temizliğine verdiği önemi 1-5 arasında puanlayın", 1, 5, "Hiç önemsemiyor", "Çok önemsiyor"),
                Text("Temizlik hizmetleri için önerileriniz."),
            ]),

        new("ulasim-otopark-2026", "Ulaşım, Yol ve Otopark Anketi",
            "Yol kalitesi, trafik, toplu taşıma ve otopark ihtiyacını ölçer.",
            "Belediye Hizmetleri", "Ulaşım", "satisfaction", 5,
            [
                Stars5("Mahallenizdeki yolların durumunu puanlayın"),
                Stars5("Kaldırımların yaya kullanımına uygunluğunu puanlayın"),
                Choice("Ulaşımda en sık hangi aracı kullanıyorsunuz?",
                    "Yürüyerek", "Otobüs", "Metro/Metrobüs", "Minibüs/Dolmuş", "Özel araç", "Motosiklet", "Bisiklet"),
                Agree("Mahallemde otopark sorunu yaşıyorum"),
                MultiChoice("Ulaşımda en çok hangi sorunu yaşıyorsunuz?",
                    "Trafik yoğunluğu", "Yol bozukluğu", "Otopark yetersizliği",
                    "Toplu taşıma seferleri az", "Durak yetersiz", "Yaya geçidi eksik", "Sorun yaşamıyorum"),
                YesNo("Mahallenizde bisiklet yolu olmasını ister misiniz?"),
                Scale("Trafik güvenliğini 1-10 arasında puanlayın", 1, 10, "Çok güvensiz", "Çok güvenli"),
                Text("Ulaşımla ilgili önerileriniz."),
            ]),

        new("park-yesil-alan-2026", "Park, Yeşil Alan ve Çocuk Oyun Alanları",
            "Parkların yeterliliği, temizliği ve oyun gruplarının durumunu ölçer.",
            "Belediye Hizmetleri", "Park", "satisfaction", 5,
            [
                Stars5("Mahallenizdeki parkların genel durumunu puanlayın"),
                Like("Mahallenizdeki parkları beğeniyor musunuz?"),
                Agree("Mahallemde yeterli sayıda yeşil alan var"),
                MultiChoice("Parklarda hangi eksikleri görüyorsunuz?",
                    "Çocuk oyun grubu", "Spor aleti", "Bank ve oturma alanı", "Aydınlatma",
                    "Temizlik", "Tuvalet", "Gölgelik", "Güvenlik", "Eksik görmüyorum"),
                Choice("Parkları en çok kiminle kullanıyorsunuz?",
                    "Yalnız", "Çocuklarımla", "Eşimle", "Arkadaşlarımla", "Evcil hayvanımla", "Kullanmıyorum"),
                Stars5("Çocuk oyun alanlarının güvenliğini puanlayın"),
                Text("Park ve yeşil alanlar için önerileriniz."),
            ]),

        new("sosyal-yardim-detay-2026", "Sosyal Yardım ve Destek Hizmetleri Anketi",
            "Sosyal yardım süreçlerine erişim, hız ve yeterliliği ölçer.",
            "Sosyal Hizmetler", "Sosyal Yardım", "satisfaction", 5,
            [
                YesNo("Belediyenin sosyal yardım hizmetlerinden yararlandınız mı?"),
                Stars5("Başvuru sürecinin kolaylığını puanlayın"),
                Stars5("Yardımın ulaşma hızını puanlayın"),
                Stars5("Görevli personelin yaklaşımını puanlayın"),
                MultiChoice("Hangi destek türlerine ihtiyaç duyuyorsunuz?",
                    "Gıda yardımı", "Yakacak yardımı", "Kırtasiye ve eğitim", "Sağlık desteği",
                    "Nakdi yardım", "Barınma", "İş bulma desteği", "Psikolojik danışmanlık"),
                Agree("Sosyal yardım hizmetleri hakkında yeterince bilgilendiriliyorum"),
                Choice("Sosyal yardımları nereden öğreniyorsunuz?",
                    "Belediye web sitesi", "Mobil uygulama", "Muhtarlık", "Sosyal medya",
                    "Komşu/tanıdık", "Belediye görevlisi", "Bilgim yok"),
                Text("Sosyal yardım hizmetleri için görüşleriniz."),
            ]),

        new("kultur-sanat-2026", "Kültür, Sanat ve Kütüphane Anketi",
            "Kültür merkezleri, kütüphaneler ve kursların değerlendirilmesi.",
            "Kültür", "Kültür", "satisfaction", 6,
            [
                Choice("Belediye kütüphanelerini kullanıyor musunuz?",
                    "Düzenli kullanıyorum", "Ara sıra kullanıyorum", "Nadiren", "Hiç kullanmadım"),
                Stars5("Kütüphanelerin fiziki koşullarını puanlayın"),
                Stars5("Kitap ve kaynak çeşitliliğini puanlayın"),
                Stars5("Kültür merkezlerinin ulaşılabilirliğini puanlayın"),
                MultiChoice("Hangi kurslara katılmak istersiniz?",
                    "Yabancı dil", "Bilgisayar ve kodlama", "Müzik", "Resim ve el sanatları",
                    "Spor", "Meslek edindirme", "Sınav hazırlık", "Diksiyon ve iletişim"),
                Like("Belediyenin kültür-sanat etkinliklerini beğeniyor musunuz?"),
                Emoji("Kültür hizmetleri hakkında genel hissiniz nedir?"),
                Text("Kültür ve sanat alanında beklentileriniz."),
            ]),

        new("dijital-hizmet-2026", "Dijital Hizmetler ve Mobil Uygulama Anketi",
            "Belediye web sitesi, mobil uygulama ve çağrı merkezi deneyimini ölçer.",
            "Belediye Hizmetleri", "Dijital", "standard", 4,
            [
                MultiChoice("Belediyeye hangi kanallardan ulaşıyorsunuz?",
                    "Mobil uygulama", "Web sitesi", "Çağrı merkezi", "Sosyal medya",
                    "Şahsen belediyeye giderek", "Muhtarlık", "WhatsApp"),
                Stars5("Belediye mobil uygulamasını puanlayın"),
                Stars5("Web sitesinin kullanım kolaylığını puanlayın"),
                Agree("Talep ve şikayetlerime zamanında dönüş yapılıyor"),
                Choice("Dijital hizmetlerde en çok neye ihtiyaç duyuyorsunuz?",
                    "Randevu alma", "Başvuru takibi", "Borç ödeme", "Etkinlik kaydı",
                    "Şikayet bildirimi", "Belge talebi", "Canlı destek"),
                YesNo("Belediye işlemlerinizi çevrimiçi yapabiliyor musunuz?"),
                Nps("Belediyenin dijital hizmetlerini başkasına önerir misiniz?"),
                Text("Dijital hizmetler için önerileriniz."),
            ]),

        new("genclik-spor-2026", "Gençlik ve Spor Hizmetleri Anketi",
            "Gençlere yönelik tesis, kurs ve spor imkanlarını değerlendirir.",
            "Gençlik", "Gençlik", "standard", 5,
            [
                Choice("Yaş aralığınız nedir?", "13-17", "18-24", "25-34", "35 ve üzeri"),
                Stars5("Spor tesislerinin yeterliliğini puanlayın"),
                Stars5("Gençlik merkezlerinin imkanlarını puanlayın"),
                MultiChoice("Hangi spor branşlarında imkan artırılmalı?",
                    "Futbol", "Basketbol", "Voleybol", "Yüzme", "Fitness", "Dövüş sporları",
                    "Tenis", "Masa tenisi", "Atletizm", "E-spor"),
                Agree("Mahallemde gençlerin vakit geçirebileceği yeterli alan var"),
                Like("Belediyenin gençlik projelerini beğeniyor musunuz?"),
                Scale("Gençlere yönelik hizmetleri 1-10 arasında puanlayın", 1, 10, "Çok yetersiz", "Çok yeterli"),
                Text("Gençlere yönelik önerileriniz."),
            ]),

        new("mahalle-oncelik-2026", "Mahalle Öncelik ve Bütçe Tercihi Anketi",
            "Vatandaşın mahallesinde bütçe önceliklerini belirlemesini sağlar.",
            "Belediye Hizmetleri", "Mahalle", "neighborhood", 5,
            [
                Choice("Mahallenizde kaç yıldır yaşıyorsunuz?",
                    "1 yıldan az", "1-5 yıl", "6-10 yıl", "11-20 yıl", "20 yıldan fazla"),
                Stars5("Mahallenizde yaşamaktan memnuniyetinizi puanlayın"),
                Choice("Belediye bütçesi mahallenizde ÖNCELİKLE nereye harcanmalı?",
                    "Yol ve kaldırım", "Park ve yeşil alan", "Temizlik", "Aydınlatma",
                    "Sosyal tesis", "Spor tesisi", "Kültür merkezi", "Otopark", "Altyapı"),
                Scale("Bu önceliğin aciliyetini 1-5 arasında değerlendirin", 1, 5, "Bekleyebilir", "Çok acil"),
                MultiChoice("Mahallenizde eksik olan tesisler hangileri?",
                    "Park", "Spor sahası", "Kütüphane", "Kültür merkezi", "Sağlık ocağı",
                    "Kreş", "Yaşlı bakım merkezi", "Otopark", "Pazar yeri"),
                Agree("Belediye mahallemin ihtiyaçlarını biliyor"),
                YesNo("Mahalle toplantılarına katılmak ister misiniz?"),
                ChoiceOptional("Görüşünüzün alınmasını istediğiniz başka bir konu var mı?",
                    "Evet, aşağıda belirteceğim", "Hayır"),
                Text("Mahallenizle ilgili eklemek istedikleriniz."),
            ]),
    ];
}
