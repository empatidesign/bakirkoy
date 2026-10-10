namespace Nexora.Domain.Enums;

/// <summary>
/// İstemcinin sürümüne göre verilen güncelleme kararı. Karar sunucuda üretilir;
/// istemci sürüm karşılaştırması yapmaz (kural değişince uygulama güncellemesi
/// gerekmemesi için).
/// </summary>
public enum MobileUpdateStatus
{
    /// <summary>Sürüm güncel — hiçbir şey gösterilmez.</summary>
    UpToDate = 0,

    /// <summary>Yeni sürüm var ama zorunlu değil — atlanabilir uyarı gösterilir.</summary>
    OptionalUpdate = 1,

    /// <summary>Sürüm desteklenmiyor — kapatılamaz güncelleme ekranı gösterilir.</summary>
    ForceUpdate = 2,
}
