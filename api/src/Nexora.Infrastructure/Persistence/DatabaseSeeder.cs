using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Nexora.Domain.Entities.AppMenu;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.MobileMenu;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Entities.Surveys;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    private static readonly Dictionary<string, string> ActionNames = new()
    {
        ["view"] = "Görüntüleme",
        ["create"] = "Ekleme",
        ["edit"] = "Düzenleme",
        ["delete"] = "Silme",
        ["export"] = "Dışa Aktarma",
        ["approve"] = "Onaylama",
        ["assign"] = "Atama",
        ["scan"] = "Tarama",
        ["send"] = "Gönderme",
        ["impersonate"] = "Kimlik Devralma",
        ["manual-open"] = "Manuel Kapı Açma",
        ["door-access"] = "Kapı QR/Manyetik Erişim Yetkisi",
        ["devices"] = "Cihaz Ayarları",
    };

    private static readonly (string Key, string Name, string Group, bool Scopable, string[] Actions)[] Catalog =
    [
        ("dashboard", "Panel Anasayfa", "Genel", false, ["view"]),
        ("participants", "Katılımcılar", "Katılımcı", true, ["view", "create", "edit", "delete", "export", "impersonate"]),
        ("family-members", "Aile Üyeleri", "Katılımcı", true, ["view", "create", "edit", "delete"]),
        ("restrictions", "Kısıtlamalar", "Katılımcı", false, ["view", "create", "edit", "delete"]),
        ("events", "Etkinlik", "Etkinlik", true, ["view", "create", "edit", "delete", "approve"]),
        ("event-categories", "Etkinlik Kategorileri", "Etkinlik", false, ["view", "create", "edit", "delete"]),
        ("sessions", "Seanslar / Başvurular", "Etkinlik", true, ["view", "create", "edit", "delete", "approve"]),
        ("qr-kiosk", "QR / Kiosk", "Etkinlik", true, ["view", "scan"]),
        ("quiz", "Bilgi Yarışması", "Etkinlik", true, ["view", "create", "edit", "delete"]),
        ("service-facilities", "Hizmet Tesisleri", "Tesisler", true, ["view", "create", "edit", "delete", "assign", "manual-open", "devices"]),
        ("facility-attendance", "Devamsızlık Düzenleme", "Tesisler", true, ["edit"]),
        ("library", "Kütüphane", "Tesisler", true, ["view", "create", "edit", "delete", "devices"]),
        ("library-mesai", "Kütüphane Mesai", "Tesisler", false, ["view", "edit", "door-access"]),
        ("sports", "Spor Salonu", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("pool", "Havuz", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("accessible-life", "Engelsiz Yaşam", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("emergency-areas", "Acil Toplanma Alanları", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("youth-camp", "Gençlik Kampı", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("scout-camp", "İzcilik Kampı", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("science-center", "Bilim Merkezi", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("seda", "Seda Eğitim", "Tesisler", true, ["view", "create", "edit", "delete", "export"]),
        ("halls", "Salonlar", "Tesisler", true, ["view", "create", "edit", "delete", "manual-open", "devices"]),
        ("kasif", "Kaşif Çocuk", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("women-family", "Kadın ve Aile", "Tesisler", true, ["view", "create", "edit", "delete"]),
        ("travels", "Gezi Sistemi", "Gezi", true, ["view", "create", "edit", "delete"]),
        ("companies", "Firma ve Kampanya", "İçerik", true, ["view", "create", "edit", "delete", "approve", "impersonate"]),
        ("bakkart", "Bakkart Başvuruları", "İçerik", false, ["view", "create", "edit", "approve"]),
        ("wheel", "Hediye Çarkı", "İçerik", true, ["view", "create", "edit", "delete", "approve"]),
        ("popups", "Popup / Duyuru", "İçerik", true, ["view", "create", "edit", "delete"]),
        ("survey", "Anketler", "İçerik", true, ["view", "create", "edit", "delete"]),
        ("mobile-menu", "Mobil Menü Yönetimi", "İçerik", false, ["view", "manage"]),
        ("mobile-config", "Mobil Uygulama Ayarları", "İçerik", false, ["view", "manage"]),
        ("system-branding", "Sistem Logosu", "Sistem", false, ["view", "manage"]),
        ("app-menu", "Uygulama Menüsü / Üst Menü", "İçerik", false, ["view", "manage"]),
        ("travel-calendar", "Gezi Takvimi", "Gezi", true, ["view", "create", "edit", "delete"]),
        ("reports", "Raporlar", "Raporlama", false, ["view", "export"]),
        ("culture-reports", "Kültür Raporlar", "Raporlama", false, ["view", "export"]),
        ("activity-reports", "Faaliyet Raporlar", "Raporlama", false, ["view", "export"]),
        ("logs", "Log Kayıtları", "İzleme", false, ["view", "export"]),
        // Kullanıcı isteği (2026-09-19) + güvenlik denetimi bulgusu: SMS gönderim
        // denetim dashboard'u kullanıcı/departman bazlı PIN-muafiyet kullanım
        // desenlerini gösteriyor — genel "logs.view" (birçok orta seviye role
        // verilir) yerine ayrı, dar kapsamlı bir izin. Yalnızca üst düzey roller
        // (SuperAdmin, İletişim/BT yöneticiliği) bu izne sahip olmalı.
        ("sms-audit", "SMS Gönderim Denetimi", "İzleme", false, ["view"]),
        ("device-monitor", "Cihaz Canlı Takip", "İzleme", false, ["view"]),
        ("quick-settings", "Hızlı Ayarlar", "Sistem", false, ["view", "edit"]),
        ("departments", "Departmanlar", "Sistem", false, ["view", "create", "edit", "delete"]),
        ("permissions", "Yetki Tanımlama", "Sistem", false, ["view", "create", "edit", "delete", "assign"]),
        ("admins", "Yönetici", "Sistem", true, ["view", "create", "edit", "delete", "assign", "impersonate"]),
        ("muhtarlik", "Muhtarlık", "Sistem", true, ["view", "edit"]),
        ("broadcast", "Toplu Bildirim / SMS", "İçerik", false, ["view", "send"]),
        ("loyalty", "Sadakat Puanı", "İçerik", false, ["view", "create", "edit", "delete"]),
        ("duty-pharmacies", "Nöbetçi Eczaneler", "Genel", false, ["view", "edit"]),
        // Kullanıcı isteği (2026-10-04): "tüm sistemde toplu sms gönderme sistemi kişilere
        // veya yetki gruplarında sms gönderme yetkisinin kimde olacağı tanımlanmalı" — önceden
        // her modülün manuel SMS ucu yalnızca o modülün kendi "{module}.edit" iznine bakıyordu;
        // SMS gönderimi için AYRI, tüm modüllerde geçerli tek bir kapı yoktu. Bu modül
        // (sms-send.send) artık SmsGovernanceService.EnsureCanSendAsync içinde TÜM manuel SMS
        // gönderim akışlarının (Tesis/Kütüphane/Gezi/SEDA/Anket/Firma/Muhtarlık/Çark/Quiz)
        // ortak kapısıdır — modül bazlı "{module}.edit" izni olsa bile bu izin yoksa SMS
        // gönderilemez. "assign" ise Roller > Toplu İşlemler sayfasından bu izni/kapsamı
        // başkalarına toplu atayabilmeyi kapsar.
        ("sms-send", "SMS Gönderme Yetkisi", "İçerik", false, ["view", "send", "assign"]),
    ];

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        await SeedPermissionCatalogAsync(db, logger);
        await BackfillCatalogAsync(db, logger);
        await MigrateLibraryMesaiPermissionAsync(db, logger);
        await MigrateDevicePermissionAsync(db, logger);
        await MigrateSmsSendPermissionAsync(db, logger);
        await SeedSuperAdminRoleAsync(db, logger);
        await BackfillSuperAdminColorAsync(db, logger);
        await AssignAllPermissionsToSuperAdminAsync(db, logger);
        await SeedSuperAdminUserAsync(db, config, logger);
        await SeedRoleTemplatesAsync(db, logger);
        await SeedDemoModuleManagersAsync(db, config, logger);
        // Demo seeder "library" modülünün tüm yetkilerini geri eklediği için daraltma EN SONDA çalışır.
        await NarrowLibraryStaffRoleAsync(db, logger);
        await SeedAppMenuAsync(db, logger);
        await BackfillDutyPharmacyModuleAsync(db, logger);
        await BackfillMuhtarlikCitizenMenuAsync(db, logger);
        await SeedMobileMenuAsync(db, logger);
        await SeedLoyaltyRulesAsync(db, logger);
        await SeedDemoAccountsAsync(db, config, logger);
    }

    // Native mobil uygulamanın (sultansehir-app) anasayfasındaki "hızlı menü" kartları
    // (Etkinlikler/Tesisler/Ödemeler/Sultan Kart üst grid'i + Nöbetçi Eczane/Toplanma
    // Yerleri/Şehir Rehberi/Randevu alt satırı) önceden uygulama kodunda sabit
    // (hardcoded) diziler olarak tanımlıydı — admin panelde zaten hazır bulunan
    // MobileMenu CRUD'u (Ayarlar > Mobil Menü) hiçbir zaman bu kartları besleyemiyordu.
    // Bu seed, önceki sabit değerleri MobileMenuItems tablosuna birebir taşır ki mobil
    // uygulama artık /api/v1/public/mobile-menu ucundan aynı kartları okusun ve admin
    // bundan sonra ikon/renk/link/sıra/görünürlüğü panelden değiştirebilsin.
    private static async Task SeedMobileMenuAsync(AppDbContext db, ILogger logger)
    {
        var any = await db.MobileMenuItems.IgnoreQueryFilters().AnyAsync();
        if (any) return;

        var order = 0;
        foreach (var s in MobileMenuSeedItems)
        {
            var item = MobileMenuItem.Create(
                s.Title, s.Icon, MenuIconType.Lucide, s.Color,
                s.ColorSecondary, s.Description,
                s.LinkType, s.LinkTarget, s.GroupKey, s.GroupTitle,
                s.IsPopular, true, s.RequiresAuth, order++);
            await db.MobileMenuItems.AddAsync(item);
        }
        await db.SaveChangesAsync();

        logger.LogInformation("MobileMenu seed: {Count} hızlı menü öğesi oluşturuldu.", MobileMenuSeedItems.Length);
    }

    private sealed record MobileMenuSeedItem(
        string Title, string Icon, string Color, string? ColorSecondary, string? Description,
        MenuLinkType LinkType, string LinkTarget,
        string GroupKey, string GroupTitle, bool IsPopular, bool RequiresAuth);

    // route: değeri mobil uygulamadaki utils/inAppLink.ts → parseInternalRoute() ile
    // uygulama içi navigasyona çözülür (WebView açmaz). ExternalUrl/WebView tipindeki
    // öğeler için LinkTarget doğrudan bir https adresidir.
    private static readonly MobileMenuSeedItem[] MobileMenuSeedItems =
    [
        new("Etkinlikler",       "CalendarDays", "#0C7FF8", "#0160D4", "Tüm Etkinlikleri Keşfedin",                MenuLinkType.Module, "route:Events",             "features", "Öne Çıkanlar",     true,  false),
        new("Tesislerimiz",      "Clock",        "#20CE87", "#05BF79", "Hizmet tesis ve merkezlerimizi keşfedin",  MenuLinkType.Module, "route:Tesisler",           "features", "Öne Çıkanlar",     true,  false),
        new("Ödemeler",          "Wallet",       "#FBAD03", "#F89C01", "Vergi Borç ve diğer Ödemelerinizi yapın",  MenuLinkType.Module, "route:Hizmetler",          "features", "Öne Çıkanlar",     true,  false),
        new("Bakırköy Kart",     "CreditCard",   "#A66BFA", "#7C3AED", "Şehrin fırsat ve avantaj kartı",           MenuLinkType.Module, "route:ProfileDetail",      "features", "Öne Çıkanlar",     true,  true),
        new("Nöbetçi Eczane",    "Syringe",      "#DC4C4C", null,      null,                                       MenuLinkType.Module, "route:Pharmacy",           "popular",  "Hizmetler",        true,  false),
        new("Toplanma Yerleri",  "ShieldAlert",  "#159A95", null,      null,                                       MenuLinkType.Module, "route:EmergencyAssembly",  "popular",  "Hizmetler",        true,  false),
        new("Şehir Rehberi",     "MapPin",       "#3679C9", null,      null,                                       MenuLinkType.Module, "route:CityGuide",          "popular",  "Hizmetler",        true,  false),
        new("Randevu Al",        "CalendarCheck","#0176B9", null,      null,                                       MenuLinkType.Module, "route:AppointmentList",    "popular",  "Hizmetler",        true,  true),
    ];

    private sealed record RealFacilitySeed(
        string Name,
        string Address,
        string Phone,
        string[] Services);

    private static readonly RealFacilitySeed[] RealServiceFacilities =
    [
        new("Cevher Dudayev Hizmet Tesisi", "İsmetpaşa, Ordu Cd. No:315", "0212 459 40 21", ["SEDA", "Karate", "Kick Boks", "Kadın Spor Salonu (Egzersiz, Pilates, Step, Aerobik, Fitness)"]),
        new("Uğur Mumcu Hizmet Tesisi", "50. Yıl Mah. Orhangazi Cd. 2133 Sk. No:87", "0212 459 40 05", ["SEDA", "Kütüphane", "Taekwondo"]),
        new("Sezai Karakoç Gençlik Spor ve Engelliler Merkezi", "Esentepe Mah. 2369 Sok. No:1", "0212 459 40 00-01", ["SEDA", "Gençlik Merkezi", "Kütüphane", "Engelsiz Kütüphane", "Güreş", "Yüzme"]),
        new("Nurettin Uzun Hizmet Tesisi", "Eski Habipler, Vefa Poyraz Cd. No:11", "0212 459 40 72", ["SEDA", "Kütüphane", "Wushu Kung-Fu"]),
        new("Sultançiftliği Hizmet Tesisi", "Sultançiftliği Mah. 169 Sk. No:26", "0212 459 40 99", ["SEDA", "Kütüphane"]),
        new("Aşık Veysel Kültür Merkezi", "Yunus Emre Mah. 1393 Sk. No:1A", "0212 459 47 00-01", ["SEDA", "Kütüphane", "Yüzme", "Fitness"]),
        new("Prof. Dr. Necmettin Erbakan Bilim ve Kültür Merkezi", "50. Yıl Mah. Muhsin Yazıcıoğlu Cd. No:166", "0212 459 40 50", ["Planetaryum", "Atölyeler", "İnovasyon Merkezi", "Tematik Sergi", "Bilim Merkezi Kütüphanesi", "Okçuluk"]),
        new("Özdemir Bayraktar Gençlik ve Kültür Merkezi", "Eski Habipler Mah. Orkideler Cd. No:28", "0212 459 40 16", ["Gençlik Merkezi", "Kütüphane", "Yüzme", "E-Spor", "Fitness"]),
        new("Şehit Ferdi Yurduseven Gençlik Merkezi", "İsmetpaşa Mah. 45. Çıkmaz Sk. No:5", "0212 459 40 25", ["Gençlik Merkezi", "Kütüphane", "Çocuk Kütüphanesi", "Masa Tenisi"]),
        new("Şehit Hikmet Baysal Gençlik Merkezi", "Sultançiftliği Mah. Gazi Mustafa Kemal Cd. No:31", "0212 459 34 51", ["Gençlik Merkezi", "Kütüphane", "Erkek Fitness Merkezi"]),
        new("Su Mekan", "Gazi Mah. 1412 Sk. No:59/61", "444 23 32", ["Kütüphane"]),
        new("Nata İstanbul (Vega AVM)", "Yunus Emre Mah. Lütfi Aykaç Blv. No:81", "444 23 32", ["Kütüphane"]),
        new("Nene Hatun Kültür Merkezi", "İsmetpaşa Mah. Ordu Cd. No:266", "444 23 32", ["Kütüphane"]),
        new("Cemil Meriç Hizmet Tesisi", "50. Yıl Mah. 2165 Sk. No:14", "444 23 32", ["Kütüphane"]),
        new("Şehit Şerife Bacı Kültür Merkezi", "Uğur Mumcu Mah. I. Cd. No:7", "444 23 32", ["Kütüphane", "Kaşif Çocuk"]),

    ];

    private static readonly Dictionary<string, (string Module, string? CatalogId)> RealServiceMappings = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SEDA"] = ("seda", null),
        ["Kütüphane"] = ("library", "library_main"),
        ["Çocuk Kütüphanesi"] = ("library", "library_kids"),
        ["Bilim Merkezi Kütüphanesi"] = ("science-center", null),
        ["Engelsiz Kütüphane"] = ("accessible-life", null),
        ["Gençlik Merkezi"] = ("youth-camp", null),
        ["Kaşif Çocuk"] = ("kasif", null),
        ["Yüzme"] = ("pool", "sports_swimming"),
        ["Fitness"] = ("sports", "sports_fitness"),
        ["Erkek Fitness Merkezi"] = ("sports", "sports_hall_male"),
        ["Masa Tenisi"] = ("sports", "sports_table_tennis"),
        ["Karate"] = ("sports", "sports_martial_arts"),
        ["Kick Boks"] = ("sports", "sports_martial_arts"),
        ["Taekwondo"] = ("sports", "sports_martial_arts"),
        ["Güreş"] = ("sports", "sports_martial_arts"),
        ["Wushu Kung-Fu"] = ("sports", "sports_martial_arts"),
        ["Okçuluk"] = ("sports", null),
        ["Kadın Spor Salonu (Egzersiz, Pilates, Step, Aerobik, Fitness)"] = ("sports", "sports_hall_female"),
        ["Planetaryum"] = ("science-center", null),
        ["Atölyeler"] = ("science-center", "edu_workshop"),
        ["İnovasyon Merkezi"] = ("science-center", null),
        ["Tematik Sergi"] = ("science-center", "culture_exhibition"),
        ["E-Spor"] = ("sports", null),
    };

    private static async Task SeedRealServiceFacilitiesAsync(AppDbContext db, ILogger logger)
    {
        var existing = await db.ServiceFacilities.IgnoreQueryFilters().ToListAsync();
        var created = 0;

        foreach (var seed in RealServiceFacilities)
        {
            var facility = existing.FirstOrDefault(x => x.Name == seed.Name);
            if (facility is null)
            {
                facility = ServiceFacility.Create(seed.Name, GetFacilityType(seed.Name), FacilityLocationType.Indoor);
                await db.ServiceFacilities.AddAsync(facility);
                created++;
            }

            facility.SetBasics(seed.Name, GetFacilityType(seed.Name), FacilityLocationType.Indoor, null, null,
                $"{seed.Name} bünyesinde sunulan belediye hizmetleri.", null);
            facility.SetLocation("İstanbul", "Bakırköy", seed.Address, null, null);
            facility.SetContact(seed.Phone, null, null, null, null);
            facility.SetOfferedServices(seed.Services.Select((name, index) =>
            {
                var mapping = RealServiceMappings.GetValueOrDefault(name, ("service-facilities", null));
                return new ServiceOfferingItem
                {
                    Id = $"real-{Array.IndexOf(RealServiceFacilities, seed) + 1:D2}-{index + 1:D2}",
                    CatalogId = mapping.CatalogId,
                    Name = name,
                    Module = mapping.Module,
                    Active = true,
                };
            }).ToList());
            facility.SetStatus(FacilityStatus.Active);
        }

        await db.SaveChangesAsync();
        logger.LogInformation("[SEED] {Total} gerçek hizmet tesisi güncellendi; {Created} yeni tesis oluşturuldu.", RealServiceFacilities.Length, created);
    }

    private static string GetFacilityType(string name)
        => name.Contains("Gençlik", StringComparison.OrdinalIgnoreCase) ? "Gençlik Merkezi"
            : name.Contains("Kültür", StringComparison.OrdinalIgnoreCase) ? "Kültür Merkezi"
            : name == "Su Mekan" || name.Contains("AVM", StringComparison.OrdinalIgnoreCase) ? "Kütüphane"
            : "Hizmet Tesisi";

    private static readonly (string Key, string Name, string EmailKey, string[] Modules)[] DemoModuleManagers =
    [
        ("events", "Etkinlik Yöneticisi", "etkinlik", ["events", "event-categories", "sessions", "qr-kiosk"]),
        ("sports", "Spor Salonu Yöneticisi", "spor", ["sports", "service-facilities", "facility-attendance", "sessions", "qr-kiosk"]),
        ("pool", "Yüzme Havuzu Yöneticisi", "havuz", ["pool", "service-facilities", "facility-attendance", "sessions", "qr-kiosk"]),
        ("youth-camp", "Gençlik Kampı Yöneticisi", "genclik-kampi", ["youth-camp", "service-facilities", "sessions", "qr-kiosk"]),
        ("scout-camp", "İzcilik Kampı Yöneticisi", "izcilik", ["scout-camp", "service-facilities", "sessions", "qr-kiosk"]),
        ("science-center", "Bilim Merkezi Yöneticisi", "bilim-merkezi", ["science-center", "service-facilities", "sessions", "qr-kiosk"]),
        ("kasif", "Kaşif Çocuk Yöneticisi", "kasif", ["kasif", "service-facilities", "sessions", "qr-kiosk"]),
        ("accessible-life", "Engelsiz Yaşam Yöneticisi", "engelsiz", ["accessible-life", "service-facilities", "sessions", "qr-kiosk"]),
        ("library", "Kütüphane Görevlisi", "kutuphane", ["library", "library-mesai", "qr-kiosk"]),
        ("travels", "Gezi Yöneticisi", "gezi", ["travels", "travel-calendar", "qr-kiosk"]),
        ("seda", "SEDA Eğitim Yöneticisi", "seda", ["seda"]),
        ("quiz", "Bilgi Yarışması Yöneticisi", "quiz", ["quiz"]),
        ("survey", "Anket Yöneticisi", "anket", ["survey"]),
        ("wheel", "Hediye Çarkı Yöneticisi", "cark", ["wheel"]),
        ("companies", "Kampanya ve Firma Yöneticisi", "kampanya", ["companies"]),
        ("emergency-areas", "Acil Toplanma Alanı Yöneticisi", "acil-alan", ["emergency-areas"]),
        ("muhtarlik", "Muhtarlık Yöneticisi", "muhtarlik", ["muhtarlik"]),
        ("halls", "Salonlar Yöneticisi", "salonlar", ["halls"]),
    ];

    private static async Task SeedDemoModuleManagersAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        if (!config.GetValue("Seed:Demo:Enabled", false)) return;

        var password = config["Seed:Demo:AdminPassword"];
        if (string.IsNullOrWhiteSpace(password)) return;

        var permissions = await db.Permissions.IgnoreQueryFilters().Where(p => p.IsActive).ToListAsync();
        var dashboardPermission = permissions.FirstOrDefault(p => p.Key == "dashboard.view");
        var created = 0;

        foreach (var demo in DemoModuleManagers)
        {
            var roleKey = $"demo-module-{demo.Key}";
            var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == roleKey);
            if (role is null)
            {
                role = Role.Create(demo.Name, roleKey, "Geliştirme ortamı modül test rolü");
                role.SetColor("#2563eb");
                await db.Roles.AddAsync(role);
                await db.SaveChangesAsync();
            }

            var desiredPermissionIds = permissions
                .Where(p => demo.Modules.Contains(p.ModuleKey) || p.Id == dashboardPermission?.Id)
                .Where(p => demo.Key != "library" || !LibraryStaffRemove.Contains(p.Key))
                .Select(p => p.Id)
                .ToHashSet();
            // IgnoreQueryFilters: soft-delete edilmiş RolePermission satırları da dahil edilmeli.
            // (RoleId, PermissionId) üzerinde partial olmayan unique index olduğu için, soft-delete
            // edilmiş bir satır görmezden gelinip yeniden eklenirse "duplicate key" hatası oluşur —
            // bu satırlar bulunduğunda restore edilmeli, yenisi eklenmemeli.
            var existingRolePermissions = await db.RolePermissions.IgnoreQueryFilters()
                .Where(rp => rp.RoleId == role.Id)
                .ToListAsync();
            var existingByPermissionId = existingRolePermissions.ToDictionary(rp => rp.PermissionId);
            var missingPermissionIds = desiredPermissionIds.Except(existingByPermissionId.Keys).ToList();
            if (missingPermissionIds.Count > 0)
                await db.RolePermissions.AddRangeAsync(missingPermissionIds.Select(id => RolePermission.Create(role.Id, id)));

            var restoredCount = 0;
            foreach (var permId in desiredPermissionIds)
            {
                if (existingByPermissionId.TryGetValue(permId, out var rp) && rp.IsDeleted)
                {
                    rp.IsDeleted = false;
                    rp.DeletedAt = null;
                    restoredCount++;
                }
            }
            if (restoredCount > 0)
                logger.LogInformation("[SEED-DEMO] {Role}: {Count} soft-delete edilmiş RolePermission geri yüklendi.", roleKey, restoredCount);

            var email = $"demo.{demo.EmailKey}@nexora.local";
            var user = await db.AdminUsers.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(password);
                user = AdminUser.Create(demo.Name, email, null, "Demo Kullanıcılar", hash, role.Id);
                user.CompletePasswordChange(hash);
                await db.AdminUsers.AddAsync(user);
                created++;
            }
            else
            {
                var hash = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)
                    ? user.PasswordHash
                    : Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(password);
                user.SetPasswordHash(hash);
                user.CompletePasswordChange(hash);
                user.Update(demo.Name, null, "Demo Kullanıcılar", role.Id);
                user.Activate();
                user.Unlock();
            }

            await db.SaveChangesAsync();
        }

        if (created > 0)
            logger.LogWarning("[SEED-DEMO] {Count} modül yöneticisi oluşturuldu. Ortak şifre yalnızca geliştirme ortamında kullanılır.", created);
    }

    private static readonly (string Key, string Label, string Icon, string Color, string CitizenRoute, string AdminRoute, bool ShowInAdminSidebar)[] ModuleDefinitions =
    [
        ("etkinlikler",     "Etkinlikler",      "CalendarDays",     "#6366F1", "/etkinlikler",                 "/events",        true),
        ("spor",            "Spor Salonu",       "Dumbbell",         "#EF4444", "/hizmetler?m=sports",          "/sports",        true),
        ("havuz",           "Yüzme Havuzu",     "Waves",            "#3B82F6", "/hizmetler?m=pool",            "/pool",          true),
        ("genclik-kampi",   "Gençlik Kampı",    "Tent",             "#10B981", "/hizmetler?m=youth-camp",      "/youth-camp",    true),
        ("izcilik",         "İzcilik Kampı",    "Compass",          "#F59E0B", "/hizmetler?m=scout-camp",      "/scout-camp",    true),
        ("bilim-merkezi",   "Bilim Merkezi",    "FlaskConical",     "#8B5CF6", "/hizmetler?m=science-center",  "/science-center",true),
        ("kasif",           "Kaşif Çocuk",      "Baby",             "#F97316", "/hizmetler?m=kasif",           "/kasif",         true),
        ("engelsiz",        "Engelsiz Yaşam",   "Accessibility",    "#6366F1", "/hizmetler?m=accessible-life", "/accessible-life",true),
        ("kutuphane",       "Kütüphane",        "BookOpen",         "#3B82F6", "/kutuphane",                   "/library",       true),
        ("geziler",         "Geziler",           "Bus",              "#10B981", "/geziler",                     "/travels",       true),
        ("seda",            "Eğitim Kurs",      "GraduationCap",    "#A855F7", "/seda",                        "/seda",          true),
        ("quiz",            "Bilgi Yarışması",  "Brain",            "#9277F0", "/yarisma",                     "/quiz",          true),
        ("anket",           "Anketler",          "ClipboardList",    "#0EA5E9", "/anketler",                    "/surveys",       true),
        ("cark",            "Hediye Çarkı",     "CircleDot",        "#F97316", "/carkim",                      "/wheel",         false),
        ("kampanya",        "Kampanyalar",       "Tag",              "#34C27A", "/kampanyalar",                 "/campaigns",     false),
        ("acil-alanlar",    "Acil Toplanma",    "ShieldAlert",      "#FF5A5A", "/acil-alanlar",                "/emergency-areas",false),
        ("nobetci-eczane",  "Nöbetçi Eczane",   "Pill",             "#22C55E", "/nobetci-eczane",              "/duty-pharmacies",false),
        ("muhtarlik",       "Muhtarlık",         "Building2",        "#64748B", "/formlarim",                   "/muhtarlik",     true),
    ];

    private static readonly (string Key, string Title, string Icon, int Order, string[] ModuleKeys)[] SectionDefinitions =
    [
        ("spor-ve-saglik",      "Spor ve Sağlık",   "Dumbbell",     1, ["spor", "havuz", "engelsiz"]),
        ("egitim-ve-kultur",    "Eğitim ve Kültür", "GraduationCap",2, ["seda", "kutuphane", "bilim-merkezi", "kasif"]),
        ("genclik-kamplari",    "Gençlik Kampları", "Tent",         3, ["genclik-kampi", "izcilik"]),
        ("etkinlikler-sosyal",  "Etkinlik ve Sosyal","CalendarDays", 4, ["etkinlikler", "geziler"]),
        ("yarismalar",          "Yarışma ve Eğlence","Brain",        5, ["quiz", "anket", "cark"]),
        ("firsat-ve-destek",    "Fırsat ve Destek", "Tag",          6, ["kampanya", "acil-alanlar", "nobetci-eczane"]),
    ];

    private static async Task SeedAppMenuAsync(AppDbContext db, ILogger logger)
    {
        var anyModules = await db.SystemModules.IgnoreQueryFilters().AnyAsync();
        if (anyModules)
            return;

        var order = 1;
        foreach (var m in ModuleDefinitions)
        {
            var module = SystemModule.Create(
                m.Key, m.Label, m.Icon, m.Color,
                m.CitizenRoute, m.AdminRoute,
                true, order++, m.ShowInAdminSidebar);
            await db.SystemModules.AddAsync(module);
        }
        await db.SaveChangesAsync();

        var modulesById = await db.SystemModules.IgnoreQueryFilters()
            .ToDictionaryAsync(m => m.Key);

        foreach (var s in SectionDefinitions)
        {
            var section = MenuSection.Create(s.Key, s.Title, s.Icon, true, true, true, s.Order);
            await db.MenuSections.AddAsync(section);
            await db.SaveChangesAsync();

            var itemOrder = 1;
            foreach (var moduleKey in s.ModuleKeys)
            {
                if (!modulesById.TryGetValue(moduleKey, out var mod))
                    continue;

                var item = MenuItem.Create(
                    section.Id, mod.Key,
                    mod.Label, mod.Icon, MenuIconType.Lucide, mod.Color,
                    MenuLinkType.Module, mod.CitizenRoute, mobileLinkTarget: null,
                    showInSidebar: true, showInMobile: true,
                    isPopular: false, isVisible: true, requiresAuth: true,
                    badgeText: null, badgeTone: null, order: itemOrder++);
                await db.MenuItems.AddAsync(item);
            }
            await db.SaveChangesAsync();
        }

        logger.LogInformation("AppMenu seed: {Modules} modül, {Sections} bölüm oluşturuldu.",
            ModuleDefinitions.Length, SectionDefinitions.Length);
    }

    private static async Task BackfillDutyPharmacyModuleAsync(AppDbContext db, ILogger logger)
    {
        const string moduleKey = "nobetci-eczane";
        if (await db.SystemModules.IgnoreQueryFilters().AnyAsync(m => m.Key == moduleKey))
            return;

        var def = ModuleDefinitions.FirstOrDefault(m => m.Key == moduleKey);
        if (def.Key is null) return;

        var maxOrder = await db.SystemModules.IgnoreQueryFilters().MaxAsync(m => (int?)m.AdminSidebarOrder) ?? 0;
        var module = SystemModule.Create(
            def.Key, def.Label, def.Icon, def.Color,
            def.CitizenRoute, def.AdminRoute, true, maxOrder + 1, def.ShowInAdminSidebar);
        await db.SystemModules.AddAsync(module);
        await db.SaveChangesAsync();

        var section = await db.MenuSections.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Key == "firsat-ve-destek");
        if (section is not null)
        {
            var nextItemOrder = (await db.MenuItems.IgnoreQueryFilters()
                .Where(i => i.SectionId == section.Id)
                .Select(i => (int?)i.Order)
                .MaxAsync()) ?? 0;

            var item = MenuItem.Create(
                section.Id, module.Key,
                module.Label, module.Icon, MenuIconType.Lucide, module.Color,
                MenuLinkType.Module, module.CitizenRoute, mobileLinkTarget: null,
                showInSidebar: true, showInMobile: true,
                isPopular: false, isVisible: true, requiresAuth: true,
                badgeText: null, badgeTone: null, order: nextItemOrder + 1);
            await db.MenuItems.AddAsync(item);
            await db.SaveChangesAsync();
        }

        logger.LogInformation("AppMenu backfill: '{ModuleKey}' modülü eklendi.", moduleKey);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-04): "Muhtarlık" modülü (vatandaşın talep/istek/şikayet
    /// gönderdiği CitizenSubmission akışı, citizen-portal'da zaten /formlarim sayfası olarak
    /// kodlanmıştı) SystemModule.CitizenRoute alanı BOŞ ("") olarak seed edilmişti — modül
    /// var, admin panelde /muhtarlik çalışıyordu, ama vatandaş portalı menüsünde (Sidebar/
    /// MobileDrawer/MunicipalMenuSheet, hepsi AppMenu tablosundan besleniyor) hiçbir link
    /// oluşmuyordu, bu yüzden vatandaş sayfayı hiç bulamıyordu. Bu backfill: (1) mevcut
    /// "muhtarlik" SystemModule kaydının CitizenRoute'u boşsa /formlarim'e günceller,
    /// (2) o modüle karşılık gelen bir MenuItem hiç yoksa "firsat-ve-destek" bölümüne ekler.
    /// </summary>
    private static async Task BackfillMuhtarlikCitizenMenuAsync(AppDbContext db, ILogger logger)
    {
        const string moduleKey = "muhtarlik";
        var module = await db.SystemModules.IgnoreQueryFilters().FirstOrDefaultAsync(m => m.Key == moduleKey);
        if (module is null) return;

        var changed = false;
        if (string.IsNullOrWhiteSpace(module.CitizenRoute))
        {
            module.Update(module.Label, module.Icon, module.Color, "/formlarim", module.AdminRoute,
                module.IsActive, module.AdminSidebarOrder, module.ShowInAdminSidebar);
            db.SystemModules.Update(module);
            changed = true;
        }

        var hasMenuItem = await db.MenuItems.IgnoreQueryFilters().AnyAsync(i => i.ModuleKey == moduleKey);
        if (!hasMenuItem)
        {
            var section = await db.MenuSections.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Key == "firsat-ve-destek");
            if (section is not null)
            {
                var nextItemOrder = (await db.MenuItems.IgnoreQueryFilters()
                    .Where(i => i.SectionId == section.Id)
                    .Select(i => (int?)i.Order)
                    .MaxAsync()) ?? 0;

                var item = MenuItem.Create(
                    section.Id, module.Key,
                    "Talep / İstek / Şikayet", module.Icon, MenuIconType.Lucide, module.Color,
                    MenuLinkType.Module, "/formlarim", mobileLinkTarget: null,
                    showInSidebar: true, showInMobile: true,
                    isPopular: false, isVisible: true, requiresAuth: true,
                    badgeText: null, badgeTone: null, order: nextItemOrder + 1);
                await db.MenuItems.AddAsync(item);
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("AppMenu backfill: '{ModuleKey}' vatandaş menü bağlantısı (/formlarim) eklendi/güncellendi.", moduleKey);
        }
    }

    private static async Task SeedRoleTemplatesAsync(AppDbContext db, ILogger logger)
    {
        var permissionsByKey = (await db.Permissions.IgnoreQueryFilters().ToListAsync())
            .ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);

        var createdRoles = 0;
        var syncedPermissions = 0;

        foreach (var template in RoleTemplateRegistry.Templates)
        {
            var permissionIds = template.PermissionKeys
                .Where(permissionsByKey.ContainsKey)
                .Select(k => permissionsByKey[k].Id)
                .ToList();

            var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == template.RoleKey);
            if (role is null)
            {
                role = Role.Create(template.RoleName, template.RoleKey, null);
                role.SetColor(template.Color);
                await db.Roles.AddAsync(role);
                await db.SaveChangesAsync();

                if (permissionIds.Count > 0)
                {
                    await db.RolePermissions.AddRangeAsync(
                        permissionIds.Select(pid => RolePermission.Create(role.Id, pid)));
                    await db.SaveChangesAsync();
                }
                createdRoles++;
            }

            var existingPermIds = (await db.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync()).ToHashSet();
            var missingPermIds = permissionIds.Where(pid => !existingPermIds.Contains(pid)).ToList();
            if (missingPermIds.Count == 0) continue;

            await db.RolePermissions.AddRangeAsync(
                missingPermIds.Select(pid => RolePermission.Create(role.Id, pid)));
            syncedPermissions += missingPermIds.Count;
            await db.SaveChangesAsync();
        }

        if (createdRoles > 0 || syncedPermissions > 0)
            logger.LogInformation("[SEED] Rol şablonları: {Roles} rol oluşturuldu, {Synced} izin senkronize edildi.", createdRoles, syncedPermissions);
    }

    private static async Task SeedPermissionCatalogAsync(AppDbContext db, ILogger logger)
    {
        if (await db.PermissionModules.IgnoreQueryFilters().AnyAsync()) return;

        var modules = new List<PermissionModule>();
        var permissions = new List<Permission>();
        var order = 1;

        foreach (var (key, name, group, scopable, actions) in Catalog)
        {
            modules.Add(PermissionModule.Create(key, name, group, order++, scopable));
            foreach (var action in actions)
            {
                var actionName = ActionNames.TryGetValue(action, out var an) ? an : action;
                permissions.Add(Permission.Create(key, action, $"{name} {actionName}"));
            }
        }

        await db.PermissionModules.AddRangeAsync(modules);
        await db.Permissions.AddRangeAsync(permissions);
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] {ModuleCount} modül, {PermCount} yetki kataloğa eklendi.", modules.Count, permissions.Count);
    }

    private static async Task BackfillCatalogAsync(AppDbContext db, ILogger logger)
    {
        var existing = (await db.PermissionModules.IgnoreQueryFilters().Select(m => m.Key).ToListAsync()).ToHashSet();
        var missing = Catalog.Where(c => !existing.Contains(c.Key)).ToList();

        var order = await db.PermissionModules.IgnoreQueryFilters().CountAsync();
        var modules = new List<PermissionModule>();
        var permissions = new List<Permission>();

        if (missing.Count > 0)
        {
            foreach (var (key, name, group, scopable, actions) in missing)
            {
                modules.Add(PermissionModule.Create(key, name, group, ++order, scopable));
                foreach (var action in actions)
                {
                    var actionName = ActionNames.TryGetValue(action, out var an) ? an : action;
                    permissions.Add(Permission.Create(key, action, $"{name} {actionName}"));
                }
            }
        }

        var existingPermKeys = (await db.Permissions.IgnoreQueryFilters()
            .Select(p => new { p.ModuleKey, p.Action })
            .ToListAsync())
            .Select(p => (p.ModuleKey, p.Action))
            .ToHashSet();
        foreach (var (key, name, _, _, actions) in Catalog)
        {
            if (missing.Any(m => m.Key == key)) continue;
            foreach (var action in actions)
            {
                if (existingPermKeys.Contains((key, action))) continue;
                var actionName = ActionNames.TryGetValue(action, out var an) ? an : action;
                permissions.Add(Permission.Create(key, action, $"{name} {actionName}"));
            }
        }

        if (modules.Count == 0 && permissions.Count == 0) return;

        await db.PermissionModules.AddRangeAsync(modules);
        await db.Permissions.AddRangeAsync(permissions);
        await db.SaveChangesAsync();

        var newIds = permissions.Select(p => p.Id).ToList();
        var superAdminRole = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == "SuperAdmin");
        if (superAdminRole is not null)
        {
            var owned = (await db.RolePermissions.Where(rp => rp.RoleId == superAdminRole.Id)
                .Select(rp => rp.PermissionId).ToListAsync()).ToHashSet();
            var toAdd = newIds.Where(id => !owned.Contains(id))
                .Select(id => RolePermission.Create(superAdminRole.Id, id)).ToList();
            if (toAdd.Count > 0)
            {
                await db.RolePermissions.AddRangeAsync(toAdd);
                await db.SaveChangesAsync();
            }
        }

        logger.LogInformation("[SEED] Eksik {M} modül, {P} yetki kataloğa eklendi.", modules.Count, permissions.Count);
    }

    // Kullanıcı isteği (2026-09-25): "Kütüphane Görevlisi" kütüphane silemez/oluşturamaz,
    // cihaz yönetemez, başka personelin mesaisini yönetemez. Yalnız kendi kütüphanelerini görür,
    // kapıdan geçer, kendi mesaisini başlatır/bitirir ve kendi geçmişini görür. Detaylı mesai
    // raporu yönetici rollerinde (Kıraathane Sorumlusu / Mesai Sorumlusu / Admin) kalır.
    // Her açılışta çalışır, idempotenttir: fazla yetkiler soft-delete edilir, eksik olan eklenir.
    private static readonly string[] LibraryStaffRoleNames = ["Kütüphane Görevlisi", "Kütüphane Görevlisi Yetkileri"];
    private static readonly HashSet<string> LibraryStaffAllowed = new(StringComparer.OrdinalIgnoreCase)
        { "dashboard.view", "library.view", "library-mesai.door-access", "qr-kiosk.view", "qr-kiosk.scan" };
    private static readonly HashSet<string> LibraryStaffRemove = new(StringComparer.OrdinalIgnoreCase)
        { "library.create", "library.delete", "library.edit", "library.devices", "library-mesai.view", "library-mesai.edit" };

    private static async Task NarrowLibraryStaffRoleAsync(AppDbContext db, ILogger logger)
    {
        var roles = await db.Roles.Where(r => LibraryStaffRoleNames.Contains(r.Name)).ToListAsync();
        if (roles.Count == 0) return;
        var perms = await db.Permissions.IgnoreQueryFilters().ToListAsync();
        var byKey = perms.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);
        var removeIds = perms.Where(p => LibraryStaffRemove.Contains(p.Key)).Select(p => p.Id).ToHashSet();
        var removed = 0; var added = 0;
        foreach (var role in roles)
        {
            var rps = await db.RolePermissions.IgnoreQueryFilters().Where(rp => rp.RoleId == role.Id).ToListAsync();
            foreach (var rp in rps.Where(rp => !rp.IsDeleted && removeIds.Contains(rp.PermissionId)))
            {
                rp.IsDeleted = true; rp.DeletedAt = DateTime.UtcNow; removed++;
            }
            foreach (var key in LibraryStaffAllowed)
            {
                if (!byKey.TryGetValue(key, out var p)) continue;
                var existing = rps.FirstOrDefault(rp => rp.PermissionId == p.Id);
                if (existing is null) { await db.RolePermissions.AddAsync(RolePermission.Create(role.Id, p.Id)); added++; }
                else if (existing.IsDeleted) { existing.IsDeleted = false; existing.DeletedAt = null; added++; }
            }
        }
        if (removed + added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("[SEED] Kütüphane Görevlisi rolü daraltıldı: {Removed} yetki kaldırıldı, {Added} yetki eklendi.", removed, added);
        }
    }

    private static async Task MigrateLibraryMesaiPermissionAsync(AppDbContext db, ILogger logger)
    {
        var libraryEdit = await db.Permissions.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.ModuleKey == "library" && p.Action == "edit");
        var mesaiPerms = await db.Permissions.IgnoreQueryFilters()
            .Where(p => p.ModuleKey == "library-mesai")
            .ToListAsync();
        if (libraryEdit is null || mesaiPerms.Count == 0) return;

        var roleIdsWithLibraryEdit = await db.RolePermissions.IgnoreQueryFilters()
            .Where(rp => rp.PermissionId == libraryEdit.Id)
            .Select(rp => rp.RoleId)
            .ToListAsync();
        if (roleIdsWithLibraryEdit.Count == 0) return;

        var existing = (await db.RolePermissions.IgnoreQueryFilters()
            .Where(rp => roleIdsWithLibraryEdit.Contains(rp.RoleId) && mesaiPerms.Select(p => p.Id).Contains(rp.PermissionId))
            .Select(rp => new { rp.RoleId, rp.PermissionId })
            .ToListAsync())
            .Select(x => (x.RoleId, x.PermissionId))
            .ToHashSet();

        var toAdd = new List<RolePermission>();
        foreach (var roleId in roleIdsWithLibraryEdit)
            foreach (var perm in mesaiPerms)
                if (!existing.Contains((roleId, perm.Id)))
                    toAdd.Add(RolePermission.Create(roleId, perm.Id));

        if (toAdd.Count == 0) return;

        await db.RolePermissions.AddRangeAsync(toAdd);
        await db.SaveChangesAsync();
        logger.LogInformation("[SEED] Mesai izin geçişi: {Count} rol-izin eşleşmesi eklendi (library.edit -> library-mesai).", toAdd.Count);
    }

    // Kullanıcı isteği (2026-10-04): yeni "sms-send.send" kapısı eklenirken, bu kapıdan ÖNCE
    // zaten manuel SMS gönderebilen roller (ör. Kütüphane Sorumlusu, Gezi Sorumlusu, SEDA
    // Sorumlusu...) aniden SMS gönderemez hale gelmesin — her SendManualMessageAsync ucunun
    // önceden tek başına yeterli saydığı modül-bazlı "{module}.edit" iznine sahip roller bu
    // migration'la otomatik olarak yeni izni de alır. Sonradan (admin panel > Roller > Toplu
    // İşlemler) bu varsayılan daraltılabilir/genişletilebilir.
    private static readonly string[] SmsSendGatingModules =
        [.. new[] { "muhtarlik", "library", "seda", "wheel", "survey", "travels", "quiz", "companies", "service-facilities" }
            .Concat(Nexora.Application.Features.Facilities.FacilityModuleRegistry.All)];

    private static async Task MigrateSmsSendPermissionAsync(AppDbContext db, ILogger logger)
    {
        var smsSendPerm = await db.Permissions.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.ModuleKey == "sms-send" && p.Action == "send");
        if (smsSendPerm is null) return;

        var gatingEditPermIds = await db.Permissions.IgnoreQueryFilters()
            .Where(p => SmsSendGatingModules.Contains(p.ModuleKey) && p.Action == "edit")
            .Select(p => p.Id)
            .ToListAsync();
        if (gatingEditPermIds.Count == 0) return;

        var roleIdsWithGatingEdit = (await db.RolePermissions.IgnoreQueryFilters()
            .Where(rp => gatingEditPermIds.Contains(rp.PermissionId))
            .Select(rp => rp.RoleId)
            .ToListAsync())
            .Distinct()
            .ToList();
        if (roleIdsWithGatingEdit.Count == 0) return;

        var alreadyHave = (await db.RolePermissions.IgnoreQueryFilters()
            .Where(rp => rp.PermissionId == smsSendPerm.Id && roleIdsWithGatingEdit.Contains(rp.RoleId))
            .Select(rp => rp.RoleId)
            .ToListAsync())
            .ToHashSet();

        var toAdd = roleIdsWithGatingEdit
            .Where(roleId => !alreadyHave.Contains(roleId))
            .Select(roleId => RolePermission.Create(roleId, smsSendPerm.Id))
            .ToList();
        if (toAdd.Count == 0) return;

        await db.RolePermissions.AddRangeAsync(toAdd);
        await db.SaveChangesAsync();
        logger.LogInformation("[SEED] sms-send.send geçişi: {Count} role otomatik SMS gönderme yetkisi verildi (önceden modül düzenleme izniyle gönderebiliyorlardı).", toAdd.Count);
    }

    private static readonly string[] DeviceOwningModules = ["service-facilities", "library", "halls"];

    private static async Task MigrateDevicePermissionAsync(AppDbContext db, ILogger logger)
    {
        var editPerms = await db.Permissions.IgnoreQueryFilters()
            .Where(p => DeviceOwningModules.Contains(p.ModuleKey) && p.Action == "edit")
            .ToListAsync();
        var devicePerms = await db.Permissions.IgnoreQueryFilters()
            .Where(p => DeviceOwningModules.Contains(p.ModuleKey) && p.Action == "devices")
            .ToListAsync();
        if (editPerms.Count == 0 || devicePerms.Count == 0) return;

        var editByModule = editPerms.ToDictionary(p => p.ModuleKey, p => p.Id);
        var deviceByModule = devicePerms.ToDictionary(p => p.ModuleKey, p => p.Id);

        var toAdd = new List<RolePermission>();
        foreach (var module in DeviceOwningModules)
        {
            if (!editByModule.TryGetValue(module, out var editId) || !deviceByModule.TryGetValue(module, out var deviceId))
                continue;

            var roleIdsWithEdit = await db.RolePermissions.IgnoreQueryFilters()
                .Where(rp => rp.PermissionId == editId)
                .Select(rp => rp.RoleId)
                .ToListAsync();
            if (roleIdsWithEdit.Count == 0) continue;

            var roleIdsWithDevice = (await db.RolePermissions.IgnoreQueryFilters()
                .Where(rp => rp.PermissionId == deviceId && roleIdsWithEdit.Contains(rp.RoleId))
                .Select(rp => rp.RoleId)
                .ToListAsync())
                .ToHashSet();

            foreach (var roleId in roleIdsWithEdit)
                if (!roleIdsWithDevice.Contains(roleId))
                    toAdd.Add(RolePermission.Create(roleId, deviceId));
        }

        if (toAdd.Count == 0) return;

        await db.RolePermissions.AddRangeAsync(toAdd);
        await db.SaveChangesAsync();
        logger.LogInformation("[SEED] Cihaz izni geçişi: {Count} rol-izin eşleşmesi eklendi (X.edit -> X.devices).", toAdd.Count);
    }

    private static async Task SeedSuperAdminRoleAsync(AppDbContext db, ILogger logger)
    {
        if (await db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Key == "SuperAdmin")) return;

        var role = Role.Create("Süper Yönetici", "SuperAdmin", "Tüm sistem üzerinde tam yetki");
        role.SetIsSuperAdmin(true);

        await db.Roles.AddAsync(role);
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] SuperAdmin rolü oluşturuldu.");
    }

    private static async Task BackfillSuperAdminColorAsync(AppDbContext db, ILogger logger)
    {
        var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == "SuperAdmin");
        if (role is null || !string.IsNullOrEmpty(role.Color)) return;

        role.SetColor(RoleColorPalette.Pick(true, []));
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] SuperAdmin rolünün rengi atandı.");
    }

    private static async Task AssignAllPermissionsToSuperAdminAsync(AppDbContext db, ILogger logger)
    {
        var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == "SuperAdmin");
        if (role is null) return;

        if (await db.RolePermissions.AnyAsync(rp => rp.RoleId == role.Id)) return;

        var allPermissionIds = await db.Permissions.IgnoreQueryFilters()
            .Where(p => p.IsActive)
            .Select(p => p.Id)
            .ToListAsync();

        if (allPermissionIds.Count == 0) return;

        await db.RolePermissions.AddRangeAsync(
            allPermissionIds.Select(pid => RolePermission.Create(role.Id, pid)));
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] SuperAdmin rolüne {Count} yetki atandı.", allPermissionIds.Count);
    }

    private static async Task SeedSuperAdminUserAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var email = config["Seed:SuperAdmin:Email"];
        var password = config["Seed:SuperAdmin:Password"];
        var fullName = config["Seed:SuperAdmin:FullName"];

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password)) return;

        var superRole = await db.Roles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Key == "SuperAdmin");

        if (superRole is null)
        {
            logger.LogWarning("[SEED] SuperAdmin rolü bulunamadı, kullanıcı oluşturulamadı.");
            return;
        }

        var exists = await db.AdminUsers.IgnoreQueryFilters()
            .AnyAsync(u => u.RoleId == superRole.Id);

        if (exists) return;

        var admin = AdminUser.Create(
            fullName ?? "Süper Yönetici",
            email,
            null,
            null,
            Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(password),
            superRole.Id);

        await db.AdminUsers.AddAsync(admin);
        await db.SaveChangesAsync();

        logger.LogWarning("[SEED] SuperAdmin kullanıcısı oluşturuldu: {Email} — şifreyi ilk girişte değiştirin.", email);
    }

    private static async Task SeedResidenceEventAsync(AppDbContext db, ILogger logger)
    {
        const string eventName = "Bakırköy Sakinleri Bilgi Yarışması";

        if (await db.Events.IgnoreQueryFilters().AnyAsync(e => e.Name == eventName)) return;

        var category = await db.EventCategories.IgnoreQueryFilters().FirstOrDefaultAsync();
        if (category is null)
        {
            category = EventCategory.Create("Genel", null, "#3B82F6", 0);
            await db.EventCategories.AddAsync(category);
            await db.SaveChangesAsync();
        }

        var nextCode = (await db.Events.IgnoreQueryFilters().CountAsync()) + 1;
        var code = $"EVT-{nextCode:D6}";

        var data = new EventData(
            eventName,
            category.Id,
            "indoor",
            null,
            null,
            null,
            new DateTime(2026, 6, 24, 10, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 6, 24, 10, 0, 0, DateTimeKind.Utc),
            true,
            "mixed",
            50,
            0,
            0,
            0,
            "none",
            0,
            "",
            "",
            "{}",
            """{"hasSessions":false,"hasSeating":false,"reservationType":"none","registrationMode":"required","attendanceEnabled":true,"entryMethod":"checkin","qrEnabled":true,"qrType":"rotating","qrRotationSeconds":30,"kioskEnabled":false,"turnstileEnabled":false,"publicLinkEnabled":false,"publicLinkRequiresPin":true,"staffIds":[]}""",
            "{}",
            "{}",
            true,
            true,
            null,
            null);

        var ev = Event.Create(data, code, "Sistem");
        await db.Events.AddAsync(ev);
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] '{Name}' etkinliği oluşturuldu.", eventName);
    }

    private static readonly (string ActionKey, string Label, int Points, string Description)[] DefaultLoyaltyRules =
    [
        ("welcome_bonus", "Hoşgeldin Bonusu", 100, "İlk kayıt olan kullanıcıya verilen hoşgeldin puanı."),
        ("daily_login", "Günlük Giriş", 10, "Her gün uygulamaya giriş yapıldığında kazanılır."),
        ("daily_login_streak_7", "7 Günlük Seri Bonusu", 50, "7 gün üst üste giriş yapıldığında ek bonus."),
        ("event_attendance", "Etkinlik Katılımı", 30, "Etkinliğe katılım sağlandığında kazanılır."),
        ("quiz_complete", "Quiz Tamamlama", 20, "Bir quiz tamamlandığında kazanılır."),
        ("survey_complete", "Anket Doldurma", 15, "Bir anket doldurulduğunda kazanılır."),
        ("travel_join", "Gezi Katılımı", 25, "Geziye katılım sağlandığında kazanılır."),
        ("event_review", "Etkinlik Değerlendirmesi", 10, "Katılınan bir etkinlik değerlendirildiğinde kazanılır."),
        ("travel_review", "Gezi Değerlendirmesi", 10, "Katılınan bir gezi değerlendirildiğinde kazanılır."),
        ("admin_grant", "Yönetici Puanı", 0, "Yönetici tarafından serbest miktarda, gerekçeli olarak verilen manuel puan. Miktar her seferinde admin tarafından belirlenir, buradaki Points alanı kullanılmaz."),
    ];

    private static async Task SeedLoyaltyRulesAsync(AppDbContext db, ILogger logger)
    {
        foreach (var (actionKey, label, points, description) in DefaultLoyaltyRules)
        {
            if (!await db.LoyaltyRules.AnyAsync(r => r.ActionKey == actionKey))
            {
                await db.LoyaltyRules.AddAsync(
                    Nexora.Domain.Entities.Loyalty.LoyaltyRule.Create(actionKey, label, points, description));
            }
        }
        await db.SaveChangesAsync();
        logger.LogInformation("[SEED] Sadakat kuralları oluşturuldu.");
    }

    // Kullanıcı isteği (2026-08-12, güncellendi 2026-10-08): "BAKIRKÖY BELEDİYESİ ANKET
    // SORULARI" — belediyenin genel hizmet kalitesi/kurumsal performans anketi, tek seferlik
    // seed edilir. TargetAudience="all" — tüm vatandaşlara açık isteğe bağlı bir anket (zorunlu
    // değil, katılım-bazlı otomasyondan bağımsız — bkz. ParticipationSurveyGenerationJob).
    // İdempotent: Title ile eşleşen aktif bir anket zaten varsa tekrar oluşturulmaz.
    private const string MainMunicipalSurveyTitle = "Bakırköy Belediyesi Anket Soruları";

    private static async Task SeedMainMunicipalSurveyAsync(AppDbContext db, ILogger logger)
    {
        if (await db.Surveys.IgnoreQueryFilters().AnyAsync(s => s.Title == MainMunicipalSurveyTitle))
            return;

        var serviceOptions = new List<string>
        {
            "Gençliğe Yönelik Faaliyetler",
            "Temizlik",
            "Parklar",
            "Kültür-Sanat Etkinlikleri",
            "Kütüphaneler",
            "Kadınlara Yönelik Faaliyetler",
            "Spor Merkezleri",
            "Kentsel Dönüşüm",
            "Sosyal Belediyecilik Hizmetleri",
            "Hiçbiri",
            "Diğer... (Belirtiniz)",
        };

        var data = new SurveyData(
            MainMunicipalSurveyTitle,
            "Bakırköy Belediyesi olarak hizmetlerimizi değerlendirmeniz ve görüşlerinizi paylaşmanız bizim için değerlidir.",
            "Belediye Hizmetleri",
            "all",
            null,
            null,
            5,
            "active",
            true,
            false,
            false,
            true,
            false,
            false,
            null,
            null,
            false);

        var survey = Survey.Create(data, "Sistem");

        var questions = new List<SurveyQuestion>
        {
            SurveyQuestion.Create(
                survey.Id, 0, "multiple_choice",
                "Bakırköy Belediyesi olarak ilçe genelinde sunduğumuz hizmet kalitesini ve kurumsal performansımızı nasıl değerlendiriyorsunuz?",
                null, true,
                ["Çok Başarılı", "Başarılı", "Ne Başarılı Ne Başarısız (Kararsızım)", "Başarılı Değil", "Hiç Başarılı Değil"],
                null, null, null, null, null),
            SurveyQuestion.Create(
                survey.Id, 1, "multiple_choice",
                "Bakırköy Belediyesi olarak en başarılı olduğumuz hizmet alanı sizce hangisidir?",
                null, true,
                serviceOptions,
                null, null, null, null, null),
            SurveyQuestion.Create(
                survey.Id, 2, "multiple_choice",
                "Bakırköy Belediyesi olarak sizce öncelik vermemiz gereken hizmet alanı hangisidir?",
                null, true,
                serviceOptions,
                null, null, null, null, null),
            SurveyQuestion.Create(
                survey.Id, 3, "text",
                "Hizmetlerimizi geliştirebilmemiz için önerileriniz nelerdir?",
                null, false,
                [], null, null, null, null, null),
            SurveyQuestion.Create(
                survey.Id, 4, "text",
                "Belediye Başkanımıza ileteceğiniz mesajınız varsa buraya yazabilirsiniz",
                null, false,
                [], null, null, null, null, null),
        };
        survey.ReplaceQuestions(questions);

        await db.Surveys.AddAsync(survey);
        await db.SaveChangesAsync();

        logger.LogInformation("[SEED] '{Title}' anketi oluşturuldu.", MainMunicipalSurveyTitle);
    }

    private static async Task SeedDemoAccountsAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        if (!config.GetValue("Seed:Demo:Enabled", false))
            return;

        try { await SeedDemoCompanyAsync(db, config, logger); }
        catch (Exception ex) { logger.LogWarning(ex, "[SEED-DEMO] Demo firma oluşturulamadı (atlandı)."); }

        try { await SeedDemoCitizenAsync(db, config, logger); }
        catch (Exception ex) { logger.LogWarning(ex, "[SEED-DEMO] Demo vatandaş oluşturulamadı (atlandı)."); }
    }

    private static async Task SeedDemoCompanyAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var companyEmail = config["Seed:Demo:Company:Email"];
        var companyPassword = config["Seed:Demo:Company:Password"];
        if (string.IsNullOrWhiteSpace(companyEmail) || string.IsNullOrWhiteSpace(companyPassword))
            return;

        var normalizedEmail = companyEmail.Trim().ToLowerInvariant();
        var taxNumber = config["Seed:Demo:Company:TaxNumber"] ?? "9990000001";
        var exists = await db.Companies.IgnoreQueryFilters()
            .AnyAsync(c => c.Email == normalizedEmail || c.TaxNumber == taxNumber);
        if (exists) return;

        var category = await db.ServiceCategories.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Name == "Demo Hizmet");
        if (category is null)
        {
            category = ServiceCategory.Create("Demo Hizmet", "Demo/test firma servis kategorisi", "#34C27A");
            await db.ServiceCategories.AddAsync(category);
            await db.SaveChangesAsync();
        }

        var company = Company.Create(
            name: config["Seed:Demo:Company:Name"] ?? "Demo Firma",
            taxNumber: taxNumber,
            phone: config["Seed:Demo:Company:Phone"] ?? "5550000002",
            email: normalizedEmail,
            address: "Zuhuratbaba Mah. Demirkapı Cad. No:1",
            district: "Bakırköy",
            passwordHash: Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(companyPassword));
        company.SetServiceCategory(category.Id);
        company.MarkEmailVerified();
        company.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(companyPassword));
        company.Approve("Demo Seed");
        await db.Companies.AddAsync(company);
        await db.SaveChangesAsync();
        logger.LogWarning("[SEED-DEMO] Onaylı demo firma oluşturuldu: {Email}", normalizedEmail);
    }

    private static async Task SeedDemoCitizenAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var citizenTckn = config["Seed:Demo:Citizen:Tckn"];
        var citizenPassword = config["Seed:Demo:Citizen:Password"];
        if (string.IsNullOrWhiteSpace(citizenTckn) || string.IsNullOrWhiteSpace(citizenPassword))
            return;

        var exists = await db.Participants.IgnoreQueryFilters().AnyAsync(p => p.Tckn == citizenTckn);
        if (exists) return;

        var citizen = Participant.Create(
            tckn: citizenTckn,
            fullName: config["Seed:Demo:Citizen:FullName"] ?? "Demo Vatandaş",
            birthDate: new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            gender: Gender.Male,
            isMinor: false,
            passwordHash: Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(citizenPassword),
            email: config["Seed:Demo:Citizen:Email"] ?? "vatandas@bakirkoy.bel.tr",
            phone: config["Seed:Demo:Citizen:Phone"] ?? "5550000001",
            guardianPhone: null,
            guardianEmail: null,
            address: "Zuhuratbaba Mah. Demirkapı Cad. No:1 Bakırköy/İstanbul");
        citizen.MarkVerified();
        citizen.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(citizenPassword));
        citizen.ApplyStructuredAddress("Zuhuratbaba Mah. Demirkapı Cad. No:1", "İstanbul", "Bakırköy", "Zuhuratbaba", ResidencyPolicyDistrictCode);
        await db.Participants.AddAsync(citizen);
        await db.SaveChangesAsync();
        logger.LogWarning("[SEED-DEMO] Aktif demo vatandaş oluşturuldu: TCKN={Tckn} (OTP mock kodu ile giriş)", citizenTckn);
    }

    private const string ResidencyPolicyDistrictCode = "2055";
}
