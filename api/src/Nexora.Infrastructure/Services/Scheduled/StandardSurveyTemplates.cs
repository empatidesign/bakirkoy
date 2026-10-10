namespace Nexora.Infrastructure.Services.Scheduled;

public record SurveyQuestionTemplate(
    string Type,
    string Question,
    string? Description,
    bool Required,
    List<string>? Options = null,
    int? ScaleMin = null,
    int? ScaleMax = null,
    string? MinLabel = null,
    string? MaxLabel = null,
    int? RatingCount = null);

public record SurveyTemplate(
    string Title,
    string Description,
    string Category,
    int EstimatedDuration,
    List<SurveyQuestionTemplate> Questions);

// Kullanıcı isteği (2026-08-12): "her modül için ana standart sorular olan sorular olsun,
// örneğin etkinliği puanlayın, bu gezinin değerlendirmesi beğendim/beğenmedim olarak
// yapılabildiği gibi etkinliklerde de hepsinde beğendim/beğenmedim ana soru ve iyi bir
// tasarımla" — tüm modüllerde AYNI iskelet (beğendim/beğenmedim ana soru + 1-5 yıldız genel
// memnuniyet + isteğe bağlı açık uçlu görüş) kullanılır, yalnızca başlık/açıklama/soru metni
// modüle/programa göre kişiselleştirilir. Bu, hem tutarlı bir vatandaş deneyimi sağlar hem de
// admin panelde SurveyAnalyticsTab'ın (like_dislike/rating skorlama) doğrudan çalışmasını
// garantiler (bkz. SurveyService.NormalizeScore).
public static class StandardSurveyTemplates
{
    private static List<SurveyQuestionTemplate> CoreQuestions(string activityLabel) =>
    [
        new(
            "like_dislike",
            $"{activityLabel} programını beğendiniz mi?",
            null,
            true),
        new(
            "rating",
            "Genel olarak bu deneyimi nasıl değerlendirirsiniz?",
            "1 yıldız çok kötü, 5 yıldız mükemmel",
            true,
            RatingCount: 5),
        new(
            "satisfaction",
            "Sunulan hizmetten ne derece memnun kaldınız?",
            null,
            false),
        new(
            "text",
            "Görüş, öneri veya şikayetinizi paylaşmak ister misiniz?",
            "İsteğe bağlı — geri bildiriminiz hizmetlerimizi geliştirmemize yardımcı olur.",
            false),
    ];

    public static SurveyTemplate EventTemplate(string eventName) => new(
        $"{eventName} — Etkinlik Değerlendirme Anketi",
        $"\"{eventName}\" etkinliğine katıldığınız için teşekkür ederiz. Görüşleriniz bizim için değerli.",
        "Etkinlik",
        2,
        CoreQuestions(eventName));

    public static SurveyTemplate TravelTemplate(string travelName) => new(
        $"{travelName} — Gezi Değerlendirme Anketi",
        $"\"{travelName}\" gezisine katıldığınız için teşekkür ederiz. Deneyiminizi bizimle paylaşır mısınız?",
        "Gezi",
        2,
        CoreQuestions(travelName));

    private static readonly Dictionary<string, string> ModuleLabels = new()
    {
        ["sports"] = "Spor Salonu",
        ["kasif"] = "Kaşif Çocuk",
        ["pool"] = "Havuz",
        ["youth-camp"] = "Gençlik Kampı",
        ["scout-camp"] = "İzcilik Kampı",
        ["science-center"] = "Bilim Merkezi",
        ["accessible-life"] = "Engelsiz Yaşam",
        ["women-family"] = "Kadın ve Aile",
    };

    private static readonly Dictionary<string, string> ModuleCategories = new()
    {
        ["sports"] = "Spor",
        ["kasif"] = "Eğitim",
        ["pool"] = "Spor",
        ["youth-camp"] = "Gençlik",
        ["scout-camp"] = "Gençlik",
        ["science-center"] = "Eğitim",
        ["accessible-life"] = "Belediye Hizmetleri",
        ["women-family"] = "Sosyal",
    };

    public static SurveyTemplate FacilityTemplate(string module, string facilityName)
    {
        var label = ModuleLabels.GetValueOrDefault(module, "Program");
        var category = ModuleCategories.GetValueOrDefault(module, "Genel");
        return new SurveyTemplate(
            $"{facilityName} — {label} Değerlendirme Anketi",
            $"\"{facilityName}\" tesisindeki {label.ToLowerInvariant()} programına katıldığınız için teşekkür ederiz.",
            category,
            2,
            CoreQuestions($"{facilityName} {label}"));
    }

    public static SurveyTemplate LibraryTemplate(string libraryName) => new(
        $"{libraryName} — Kütüphane Hizmet Anketi",
        $"\"{libraryName}\" kütüphanesini ziyaret ettiğiniz için teşekkür ederiz. Hizmetimizi değerlendirir misiniz?",
        "Kütüphane",
        2,
        CoreQuestions(libraryName));
}
