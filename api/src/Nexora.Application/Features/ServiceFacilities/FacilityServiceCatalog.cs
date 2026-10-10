using Nexora.Application.Features.ServiceFacilities.Dtos;

namespace Nexora.Application.Features.ServiceFacilities;

public record FacilityServiceCatalogItemDto(
    string Id,
    string Name,
    string Module,
    string? Description,
    string? Icon);

public static class FacilityServiceCatalog
{
    public static IReadOnlyList<FacilityServiceCatalogItemDto> Items { get; } =
    [
        new("sports_hall", "Spor Salonu", "sports", null, "dumbbell"),
        new("sports_hall_male", "Spor Salonu (Bay)", "sports", null, "dumbbell"),
        new("sports_hall_female", "Spor Salonu (Bayan)", "sports", null, "dumbbell"),
        new("sports_fitness", "Fitness Merkezi", "sports", null, "activity"),
        new("sports_pilates", "Pilates / Yoga Studyo", "sports", null, "flower-2"),
        new("sports_swimming", "Yüzme Havuzu", "sports", null, "waves"),
        new("sports_swimming_kids", "Çocuk Yüzme Havuzu", "sports", null, "baby"),
        new("sports_basketball", "Basketbol Sahası", "sports", null, "circle-dot"),
        new("sports_football", "Futbol Sahası", "sports", null, "circle-dot"),
        new("sports_tennis", "Tenis Kortu", "sports", null, "circle-dot"),
        new("sports_volleyball", "Voleybol Sahası", "sports", null, "circle-dot"),
        new("sports_table_tennis", "Masa Tenisi", "sports", null, "table-2"),
        new("sports_martial_arts", "Dövüş Sporları Salonu", "sports", null, "shield"),
        new("sports_climbing", "Tırmanma Duvarı", "sports", null, "mountain"),
        new("sports_walking_track", "Yürüyüş / Koşu Parkuru", "sports", null, "footprints"),
        new("sports_horse_riding", "At Binme Pisti", "sports", null, "rabbit"),
        new("sports_cycling", "Bisiklet Yolu", "sports", null, "bike"),

        new("library_main", "Kütüphane", "library", null, "book-open"),
        new("library_kids", "Çocuk Kütüphanesi", "library", null, "baby"),
        new("library_youth", "Gençlik Kütüphanesi", "library", null, "graduation-cap"),
        new("library_open_air", "Açık Hava Kütüphanesi", "library", null, "trees"),
        new("library_digital", "Dijital Kütüphane / Lab", "library", null, "monitor"),
        new("library_silent_room", "Sessiz Çalışma Salonu", "library", null, "volume-x"),
        new("library_group_room", "Grup Çalışma Odası", "library", null, "users-round"),
        new("library_book_cafe", "Kitap Kafe", "library", null, "coffee"),
        new("library_archive", "Arşiv / Koleksiyon", "library", null, "archive"),

        new("edu_classroom", "Dersane / Sınıf", "education", null, "graduation-cap"),
        new("edu_lecture_hall", "Konferans Salonu", "education", null, "presentation"),
        new("edu_workshop", "Atölye", "education", null, "wrench"),
        new("edu_computer_lab", "Bilgisayar Laboratuvarı", "education", null, "monitor"),
        new("edu_language_course", "Yabancı Dil Kursu", "education", null, "languages"),
        new("edu_exam_prep", "Sınav Hazırlık (TYT/AYT/LGS)", "education", null, "check-square"),
        new("edu_career_workshop", "Kariyer / Mesleki Eğitim", "education", null, "briefcase"),
        new("edu_quran_course", "Kur'an Kursu", "education", null, "book"),

        new("culture_cinema", "Sinema Salonu", "culture", null, "clapperboard"),
        new("culture_theater", "Tiyatro Salonu", "culture", null, "drama"),
        new("culture_amphi", "Açık Amfi Tiyatro", "culture", null, "drama"),
        new("culture_music_course", "Müzik Kursu", "culture", null, "music"),
        new("culture_music_studio", "Müzik Studyosu", "culture", null, "mic"),
        new("culture_art_studio", "Resim / Heykel Atölyesi", "culture", null, "palette"),
        new("culture_ceramic", "Seramik Atölyesi", "culture", null, "circle"),
        new("culture_photo_studio", "Fotoğraf Studyosu", "culture", null, "camera"),
        new("culture_dance", "Dans Salonu", "culture", null, "flower-2"),
        new("culture_handcraft", "El Sanatları Atölyesi", "culture", null, "scissors"),
        new("culture_exhibition", "Sergi Salonu", "culture", null, "image"),

        new("events_multi_purpose", "Çok Amaçlı Salon", "events", null, "calendar"),
        new("events_open_area", "Açık Etkinlik Alanı", "events", null, "trees"),
        new("events_meeting_room", "Toplantı Odası", "events", null, "users-round"),
        new("events_wedding_hall", "Düğün / Nişan Salonu", "events", null, "heart"),
        new("events_concert", "Konser Alanı", "events", null, "mic-2"),
        new("events_picnic", "Piknik Alanı", "events", null, "utensils"),

        new("health_polyclinic", "Poliklinik", "health", null, "stethoscope"),
        new("health_dental", "Diş Polikliniği", "health", null, "smile"),
        new("health_rehab", "Rehabilitasyon Birimi", "health", null, "heart-pulse"),
        new("health_psych", "Psikolojik Danışmanlık", "health", null, "brain"),
        new("health_first_aid", "İlk Yardım Noktası", "health", null, "plus-square"),

        new("social_elderly", "Yaşlı Bakım Birimi", "social", null, "users"),
        new("social_youth_club", "Gençlik Kulübü", "social", null, "users-round"),
        new("social_kids_play", "Çocuk Oyun Alanı", "social", null, "baby"),
        new("social_kids_kindergarten", "Kreş / Anaokulu", "social", null, "baby"),
        new("social_disabled", "Engelli Hizmet Birimi", "social", null, "accessibility"),
        new("social_women_center", "Kadın Danışma Merkezi", "social", null, "user-round"),
        new("social_food_aid", "Aşevi / Gıda Bankası", "social", null, "utensils"),
    ];
}
