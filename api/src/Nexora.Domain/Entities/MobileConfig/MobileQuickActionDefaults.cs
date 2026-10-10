namespace Nexora.Domain.Entities.MobileConfig;

/// <summary>
/// Panel devreye girmeden önce uygulamada gömülü olan 12 kart. Seed verisi
/// bunlarla birebir aynıdır: özellik açıldığında kullanıcı arayüzünde hiçbir
/// şey değişmez, panel yalnızca bu listeyi düzenlenebilir hale getirir.
/// </summary>
public static class MobileQuickActionDefaults
{
    public record Seed(
        Guid Id, string Target, string Label, string Icon, string Color,
        int SortOrder, bool RequiresAuth, string? TargetUrl);

    public static readonly IReadOnlyList<Seed> All =
    [
        new(new("00000000-0000-0000-0000-00000000ca01"), "emergency", "Acil", "Siren", "#E11D48", 10, false, null),
        new(new("00000000-0000-0000-0000-00000000ca02"), "pharmacy", "Nöbetçi\nEczane", "Pill", "#7C3AED", 20, false, null),
        new(new("00000000-0000-0000-0000-00000000ca03"), "ebelediye", "e-Belediye", "Landmark", "#0284C7", 30, false, null),
        new(new("00000000-0000-0000-0000-00000000ca04"), "cityguide", "Şehir\nRehberi", "MapPin", "#16A34A", 40, false, null),
        new(new("00000000-0000-0000-0000-00000000ca05"), "request", "Talep\nŞikayet", "MessageSquare", "#D97706", 50, false, null),
        new(new("00000000-0000-0000-0000-00000000ca06"), "applications", "Başvurularım", "FileText", "#9333EA", 60, true, null),
        new(new("00000000-0000-0000-0000-00000000ca07"), "facilities", "Tesisler", "Building2", "#0891B2", 70, false, null),
        new(new("00000000-0000-0000-0000-00000000ca08"), "events", "Etkinlikler", "Calendar", "#DB2777", 80, false, null),
        new(new("00000000-0000-0000-0000-00000000ca09"), "announcements", "Duyurular", "Megaphone", "#059669", 90, false, null),
        new(new("00000000-0000-0000-0000-00000000ca10"), "services", "Hizmetler", "LayoutGrid", "#4F46E5", 100, false, null),
        new(new("00000000-0000-0000-0000-00000000ca11"), "search", "Hızlı\nArama", "Search", "#4F46E5", 110, false, null),
        new(new("00000000-0000-0000-0000-00000000ca12"), "callcenter", "Çağrı\nMerkezi", "PhoneCall", "#059669", 120, false, null),
    ];
}
