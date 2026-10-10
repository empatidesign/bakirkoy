using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Notifications;

/// <summary>
/// Kullanıcı isteği (2026-08-11): Gezi/SEDA/Tesis/Kütüphane/Firma modüllerindeki şablonlu
/// SMS/bildirim sisteminin, kendi ayrı ayar tablosu OLMAYAN modüllere (Quiz, Anket, Çark/Hediye,
/// Muhtarlık) yayılması. Bu 4 modül için ayrı ayrı 4 tablo açmak yerine, module anahtarıyla
/// paylaşılan TEK bir ayar tablosu kullanılıyor (Company/Event'teki tek-satır JSON-blob deseninin
/// çok-modüllü genellemesi). Her modülün kendi <see cref="Module"/> anahtarıyla (quiz/survey/
/// wheel/muhtarlik) tek bir satırı olur, ConfigJson içinde notificationTemplates dizisi saklanır.
/// </summary>
public class ModuleNotificationSettings : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public string ConfigJson { get; private set; } = "{}";

    public static ModuleNotificationSettings Create(string module, string configJson)
        => new() { Module = module, ConfigJson = string.IsNullOrWhiteSpace(configJson) ? "{}" : configJson };

    public void Update(string configJson)
    {
        ConfigJson = string.IsNullOrWhiteSpace(configJson) ? "{}" : configJson;
        UpdatedAt = DateTime.UtcNow;
    }
}
