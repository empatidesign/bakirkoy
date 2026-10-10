using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.MobileConfig;

/// <summary>
/// Mobil alt tab bar'ın orta butonundan açılan hızlı işlem kartı.
///
/// Kartın nereye gideceği serbest metin DEĞİL, uygulamanın tanıdığı sabit
/// hedeflerden biridir (<see cref="Target"/>). Panelden bilinmeyen bir hedef
/// girilse bile istemci o kartı gizler; ölü kart kullanıcıya çıkmaz.
/// </summary>
public class MobileQuickAction : BaseEntity
{
    /// <summary>
    /// Aynı anda aktif olabilecek en fazla kart sayısı. Menü 3 sıra × 4 sütunluk
    /// bir ızgaradır; fazlası istemcide sessizce kırpılırdı, bu yüzden sınır
    /// panelde uygulanır.
    /// </summary>
    public const int MaxActiveCount = 12;

    /// <summary>İstemcinin tanıdığı hedef anahtarı (ör. "pharmacy", "events").</summary>
    public string Target { get; private set; } = string.Empty;

    /// <summary>Kart üzerindeki başlık. "\n" ile iki satıra bölünebilir.</summary>
    public string Label { get; private set; } = string.Empty;

    /// <summary>İstemcinin ikon setindeki ad (ör. "Siren"). Tanınmazsa varsayılan ikon kullanılır.</summary>
    public string Icon { get; private set; } = string.Empty;

    /// <summary>Kartın ana rengi (#RRGGBB). İstemci diğer tonları bundan türetir.</summary>
    public string Color { get; private set; } = string.Empty;

    /// <summary>Küçükten büyüğe sıralama. Aynı değerde Label'a göre sıralanır.</summary>
    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; } = true;

    /// <summary>
    /// Yalnızca giriş yapmış kullanıcıya gösterilir. Girişsiz kullanıcıyı
    /// giriş ekranına atan hedefler (ör. başvurularım) için işaretlenir.
    /// </summary>
    public bool RequiresAuth { get; private set; }

    /// <summary>Hedef harici bir adres/telefon ise kullanılacak değer.</summary>
    public string? TargetUrl { get; private set; }

    public static MobileQuickAction Create(
        string target, string label, string icon, string color,
        int sortOrder, bool isActive, bool requiresAuth, string? targetUrl)
    {
        var item = new MobileQuickAction();
        item.Apply(target, label, icon, color, sortOrder, isActive, requiresAuth, targetUrl);
        return item;
    }

    public void Apply(
        string target, string label, string icon, string color,
        int sortOrder, bool isActive, bool requiresAuth, string? targetUrl)
    {
        Target = target.Trim();
        Label = label.Trim();
        Icon = icon.Trim();
        Color = color.Trim();
        SortOrder = sortOrder;
        IsActive = isActive;
        RequiresAuth = requiresAuth;
        TargetUrl = string.IsNullOrWhiteSpace(targetUrl) ? null : targetUrl.Trim();
    }

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
